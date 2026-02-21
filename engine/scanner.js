// engine/scanner.js – High-frequency pool scanner (Super Turbo Finder)
'use strict';

const { ethers } = require('ethers');

const UNISWAP_V3_POOL_ABI = [
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() external view returns (uint128)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function fee() external view returns (uint24)',
];

const UNISWAP_V3_FACTORY_ABI = [
  'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)',
];

const UNISWAP_V2_PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
];

const UNISWAP_V2_FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) external view returns (address pair)',
];

// Uniswap V3 Factory addresses (same across most chains)
const UNI_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
// SushiSwap V2 Factory addresses per chainId
const SUSHI_FACTORIES = {
  1:     '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
  137:   '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
  42161: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
  56:    '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
};

class PoolScanner {
  /**
   * @param {ethers.Provider} provider
   * @param {object} chainConfig  – entry from engine/config.js CHAINS
   */
  constructor(provider, chainConfig) {
    this.provider    = provider;
    this.chainConfig = chainConfig;
    this.uniV3Factory = new ethers.Contract(UNI_V3_FACTORY, UNISWAP_V3_FACTORY_ABI, provider);
    const sushiFactory = SUSHI_FACTORIES[chainConfig.chainId];
    this.sushiFactory  = sushiFactory
      ? new ethers.Contract(sushiFactory, UNISWAP_V2_FACTORY_ABI, provider)
      : null;
  }

  /**
   * Scan all fee tiers for a token pair on Uniswap V3 and get their prices.
   * @returns {Array<{pool, fee, price}>}
   */
  async scanUniswapV3Pools(tokenA, tokenB) {
    const feeTiers = [500, 3000, 10000];
    const results  = [];

    await Promise.all(
      feeTiers.map(async (fee) => {
        try {
          const poolAddr = await this.uniV3Factory.getPool(tokenA, tokenB, fee);
          if (poolAddr === ethers.ZeroAddress) return;

          const pool   = new ethers.Contract(poolAddr, UNISWAP_V3_POOL_ABI, this.provider);
          const [slot0, liquidity, t0] = await Promise.all([
            pool.slot0(),
            pool.liquidity(),
            pool.token0(),
          ]);

          if (liquidity === 0n) return;

          // Use BigInt arithmetic scaled to 1e18 to avoid float precision loss.
          // price = (sqrtPriceX96 / 2^96)^2 = sqrtPriceX96^2 / 2^192
          const sqrtPrice = slot0.sqrtPriceX96;
          const SCALE     = 10n ** 18n;
          const Q192      = 2n ** 192n;
          const priceScaled = (sqrtPrice * sqrtPrice * SCALE) / Q192; // price * 1e18
          const adjScaled   = t0.toLowerCase() === tokenA.toLowerCase()
            ? priceScaled
            : (SCALE * SCALE) / priceScaled; // invert: 1/price scaled
          // Store as a BigInt (scaled by 1e18) and also as a float for spread comparison
          const price   = Number(adjScaled) / 1e18;
          const adjusted = price;

          results.push({ pool: poolAddr, fee, price: adjusted, liquidity, source: 'uniswapV3' });
        } catch {
          // pool doesn't exist or call reverted – skip
        }
      })
    );

    return results;
  }

  /**
   * Get price from a SushiSwap V2 pair.
   */
  async scanSushiswapPair(tokenA, tokenB) {
    if (!this.sushiFactory) return null;
    try {
      const pairAddr = await this.sushiFactory.getPair(tokenA, tokenB);
      if (pairAddr === ethers.ZeroAddress) return null;

      const pair = new ethers.Contract(pairAddr, UNISWAP_V2_PAIR_ABI, this.provider);
      const [reserves, t0] = await Promise.all([pair.getReserves(), pair.token0()]);

      const [r0, r1] = [reserves.reserve0, reserves.reserve1];
      if (r0 === 0n || r1 === 0n) return null;

      // Use BigInt arithmetic scaled to 1e18 to avoid float precision loss on large reserves.
      const SCALE   = 10n ** 18n;
      const priceScaled = t0.toLowerCase() === tokenA.toLowerCase()
        ? (r1 * SCALE) / r0
        : (r0 * SCALE) / r1;
      const price = Number(priceScaled) / 1e18;

      return { pair: pairAddr, price, source: 'sushiswap' };
    } catch {
      return null;
    }
  }

  /**
   * Find arbitrage opportunities between Uniswap V3 and SushiSwap for a pair.
   * Returns opportunities sorted by estimated profit descending.
   *
   * @param {string} tokenA
   * @param {string} tokenB
   * @param {number} minProfitBps  Minimum profit in basis points (default 10 = 0.1%)
   * @returns {Array<{buy, sell, spread, profitBps}>}
   */
  async findArbitrageOpportunities(tokenA, tokenB, minProfitBps = 10) {
    const [v3Pools, sushiPair] = await Promise.all([
      this.scanUniswapV3Pools(tokenA, tokenB),
      this.scanSushiswapPair(tokenA, tokenB),
    ]);

    const allPools = [...v3Pools];
    if (sushiPair) allPools.push(sushiPair);

    const opportunities = [];

    for (let i = 0; i < allPools.length; i++) {
      for (let j = i + 1; j < allPools.length; j++) {
        const a = allPools[i];
        const b = allPools[j];
        if (a.price === 0 || b.price === 0) continue;

        const spread     = Math.abs(a.price - b.price) / Math.min(a.price, b.price);
        const profitBps  = Math.round(spread * 10000);
        if (profitBps < minProfitBps) continue;

        const buy  = a.price < b.price ? a : b;
        const sell = a.price < b.price ? b : a;

        opportunities.push({ buy, sell, spread, profitBps, tokenA, tokenB });
      }
    }

    return opportunities.sort((x, y) => y.profitBps - x.profitBps);
  }
}

module.exports = { PoolScanner };
