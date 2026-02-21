// engine/index.js – Super Turbo Finder: main arbitrage engine entry point
'use strict';

require('dotenv').config();
const { ethers }        = require('ethers');
const { CHAINS, tokenDecimals } = require('./config');
const { PoolScanner }   = require('./scanner');
const { ArbExecutor }   = require('./executor');
const { FlashbotsProvider } = require('./flashbots');

// ── Configuration ─────────────────────────────────────────────────────────────

const CHAIN_NAME   = process.env.CHAIN || 'ethereum';
const CHAIN        = CHAINS[CHAIN_NAME];
if (!CHAIN) {
  console.error(`Unknown chain: ${CHAIN_NAME}. Valid: ${Object.keys(CHAINS).join(', ')}`);
  process.exit(1);
}

const PRIVATE_KEY        = process.env.PRIVATE_KEY;
const ARB_CONTRACT_ADDR  = process.env.ARB_CONTRACT_ADDRESS;
const SCAN_INTERVAL_MS   = parseInt(process.env.SCAN_INTERVAL_MS || '2000', 10);
const MIN_PROFIT_BPS     = parseInt(process.env.MIN_PROFIT_BPS   || '15',   10);
const LOAN_AMOUNT_USD    = parseFloat(process.env.LOAN_AMOUNT_USD || '10000');
const TRADE_LIVE         = process.env.TRADE_LIVE === 'true';

// Token pairs to monitor on each chain
const MONITOR_PAIRS = [
  [CHAIN.usdc, CHAIN.usdt],
  [CHAIN.usdc, CHAIN.dai],
  [CHAIN.usdt, CHAIN.dai],
  [CHAIN.weth, CHAIN.usdc],
  [CHAIN.weth, CHAIN.usdt],
];

// ── Setup ─────────────────────────────────────────────────────────────────────

function buildProvider() {
  const rpcUrl = process.env[CHAIN.rpcEnv];
  if (!rpcUrl) throw new Error(`Missing env var: ${CHAIN.rpcEnv}`);

  // Proxy socket support: if rpcUrl starts with ws:// use WebSocket provider
  if (rpcUrl.startsWith('ws')) {
    return new ethers.WebSocketProvider(rpcUrl);
  }
  return new ethers.JsonRpcProvider(rpcUrl);
}

// ── Main Loop ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀  Super Turbo Finder — ${CHAIN.name}`);
  console.log(`     Trade Live : ${TRADE_LIVE}`);
  console.log(`     Loan USD   : $${LOAN_AMOUNT_USD.toLocaleString()}`);
  console.log(`     Min Profit : ${MIN_PROFIT_BPS} bps\n`);

  const provider = buildProvider();
  const wallet   = PRIVATE_KEY
    ? new ethers.Wallet(PRIVATE_KEY, provider)
    : null;

  if (TRADE_LIVE && !wallet) {
    console.error('PRIVATE_KEY not set – cannot trade live.');
    process.exit(1);
  }

  if (TRADE_LIVE && !ARB_CONTRACT_ADDR) {
    console.error('ARB_CONTRACT_ADDRESS not set – cannot trade live.');
    process.exit(1);
  }

  // Flashbots provider (mainnet only)
  let flashbots = null;
  if (CHAIN.flashbots && wallet) {
    const fbAuthSigner = ethers.Wallet.createRandom();
    flashbots = new FlashbotsProvider(provider, fbAuthSigner);
    console.log('⚡  Flashbots relay enabled');
  }

  const scanner  = new PoolScanner(provider, CHAIN);
  const executor = TRADE_LIVE
    ? new ArbExecutor(wallet, ARB_CONTRACT_ADDR, CHAIN)
    : null;

  let scanCount = 0;

  // ── Scan loop ──────────────────────────────────────────────────────────────
  const scan = async () => {
    scanCount++;
    const ts = new Date().toISOString();

    for (const [tokenA, tokenB] of MONITOR_PAIRS) {
      try {
        const opps = await scanner.findArbitrageOpportunities(tokenA, tokenB, MIN_PROFIT_BPS);

        if (opps.length === 0) continue;

        const best = opps[0];
        console.log(
          `[${ts}] 💰  Arb found: ${best.profitBps} bps | ` +
          `${best.buy.source} → ${best.sell.source} | ` +
          `${tokenA.slice(0, 6)}…/${tokenB.slice(0, 6)}…`
        );

        if (TRADE_LIVE && executor) {
          // Encode arbitrage params based on the best opportunity
          const dex1 = best.buy.source  === 'uniswapV3' ? 1 : 2;
          const dex2 = best.sell.source === 'uniswapV3' ? 1 : 2;

          const arbParamsObj = {
            dex1,
            dex2,
            tokenBorrow:       tokenA,
            tokenIntermediate: tokenB,
            fee1:              best.buy.fee  ?? 3000,
            fee2:              best.sell.fee ?? 3000,
            curvePool1:        ethers.ZeroAddress,
            curvePool2:        ethers.ZeroAddress,
            curveI1:           0n,
            curveJ1:           0n,
            curveI2:           0n,
            curveJ2:           0n,
            amountOutMin1:     0n, // set slippage protection in production
            amountOutMin2:     0n,
          };

          // Derive correct decimals for the borrowed token from the config lookup.
          const decimals  = tokenDecimals(tokenA);
          const loanAmount = ethers.parseUnits(String(LOAN_AMOUNT_USD), decimals);

          try {
            await executor.execute(best, loanAmount, arbParamsObj);
          } catch (execErr) {
            console.error(`[executor] Error: ${execErr.message}`);
          }
        }
      } catch (scanErr) {
        console.error(`[scanner] Error scanning ${tokenA}/${tokenB}: ${scanErr.message}`);
      }
    }

    if (scanCount % 100 === 0) {
      console.log(`[${ts}] 🔄  Scans completed: ${scanCount}`);
    }
  };

  // Run first scan immediately, then on interval
  await scan();
  setInterval(scan, SCAN_INTERVAL_MS);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
