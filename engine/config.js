// engine/config.js – Chain & DEX configuration for cross-chain support
'use strict';

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

module.exports = { CHAINS };
