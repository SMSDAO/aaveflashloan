require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x' + '0'.repeat(64);

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: '0.8.20',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  paths: {
    sources: './contracts/v3',
  },
  networks: {
    hardhat: {},
    ethereum: {
      url: process.env.RPC_ETHEREUM || '',
      accounts: [PRIVATE_KEY],
      chainId: 1,
    },
    polygon: {
      url: process.env.RPC_POLYGON || '',
      accounts: [PRIVATE_KEY],
      chainId: 137,
    },
    arbitrum: {
      url: process.env.RPC_ARBITRUM || '',
      accounts: [PRIVATE_KEY],
      chainId: 42161,
    },
    bsc: {
      url: process.env.RPC_BSC || 'https://bsc-dataseed1.binance.org/',
      accounts: [PRIVATE_KEY],
      chainId: 56,
    },
  },
  etherscan: {
    apiKey: {
      mainnet:  process.env.ETHERSCAN_API_KEY  || '',
      polygon:  process.env.POLYGONSCAN_API_KEY || '',
      arbitrum: process.env.ARBISCAN_API_KEY    || '',
      bsc:      process.env.BSCSCAN_API_KEY     || '',
    },
  },
};
