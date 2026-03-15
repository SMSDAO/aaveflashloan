require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();

// Only populate accounts for live networks when PRIVATE_KEY is explicitly set.
// Using a deterministic all-zero key as a fallback is a security risk.
const liveAccounts = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [];

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
      accounts: liveAccounts,
      chainId: 1,
    },
    polygon: {
      url: process.env.RPC_POLYGON || '',
      accounts: liveAccounts,
      chainId: 137,
    },
    arbitrum: {
      url: process.env.RPC_ARBITRUM || '',
      accounts: liveAccounts,
      chainId: 42161,
    },
    bsc: {
      url: process.env.RPC_BSC || 'https://bsc-dataseed1.binance.org/',
      accounts: liveAccounts,
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
