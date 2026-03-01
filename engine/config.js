// engine/config.js – Chain & DEX configuration for cross-chain support
'use strict';

// Token decimals lookup: address (lowercase) → decimals
// Used to compute loan amounts correctly for any borrowed token.
const TOKEN_DECIMALS = {
  // USDC  (6 decimals on all chains)
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 6,  // ETH
  '0x2791bca1f2de4661ed88a30c99a7a9449aa84174': 6,  // Polygon USDC.e
  '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8': 6,  // Arbitrum USDC.e
  '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': 18, // BSC USDC (18!)
  // USDT  (6 decimals on ETH/Polygon/Arbitrum, 18 on BSC)
  '0xdac17f958d2ee523a2206206994597c13d831ec7': 6,  // ETH
  '0xc2132d05d31c914a87c6611c10748aeb04b58e8f': 6,  // Polygon
  '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': 6,  // Arbitrum
  '0x55d398326f99059ff775485246999027b3197955': 18, // BSC
  // DAI (18 decimals everywhere)
  '0x6b175474e89094c44da98b954eedeac495271d0f': 18,
  '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063': 18,
  '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1': 18,
  '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3': 18,
  // WETH / WMATIC / WBNB (18 decimals)
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 18,
  '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270': 18,
  '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': 18,
  '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c': 18,
};

/**
 * Return the number of decimals for a token address.
 * Falls back to 18 if unknown.
 */
function tokenDecimals(address) {
  return TOKEN_DECIMALS[address.toLowerCase()] ?? 18;
}

const CHAINS = {
  ethereum: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    rpcEnv: 'RPC_ETHEREUM',
    aavePoolAddressProvider: '0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e',
    uniswapV3Router:  '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    sushiswapRouter:  '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
    weth:             '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    usdc:             '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    usdt:             '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    dai:              '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    flashbots:        true,
  },
  polygon: {
    chainId: 137,
    name: 'Polygon',
    rpcEnv: 'RPC_POLYGON',
    aavePoolAddressProvider: '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb',
    uniswapV3Router:  '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    sushiswapRouter:  '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    weth:             '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
    // Note: using bridged USDC.e; native USDC is 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
    usdc:             '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    usdt:             '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    dai:              '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    flashbots:        false,
  },
  arbitrum: {
    chainId: 42161,
    name: 'Arbitrum One',
    rpcEnv: 'RPC_ARBITRUM',
    aavePoolAddressProvider: '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb',
    uniswapV3Router:  '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    sushiswapRouter:  '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    weth:             '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    usdc:             '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    usdt:             '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    dai:              '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    flashbots:        false,
  },
  bsc: {
    chainId: 56,
    name: 'BNB Smart Chain',
    rpcEnv: 'RPC_BSC',
    aavePoolAddressProvider: '0xff75B6da14FfbbfD355Daf7a2731456b3562Ba6D',
    uniswapV3Router:  '0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2', // PancakeSwap V3
    sushiswapRouter:  '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    weth:             '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
    usdc:             '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    usdt:             '0x55d398326f99059fF775485246999027B3197955',
    dai:              '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3',
    flashbots:        false,
  },
};

module.exports = { CHAINS, tokenDecimals };
