// engine/executor.js – Arbitrage transaction executor
'use strict';

const { ethers } = require('ethers');

const ARB_CONTRACT_ABI = [
  'function executeArbitrage(address asset, uint256 amount, bytes calldata arbParams) external',
  'event ArbExecuted(address indexed tokenBorrow, uint256 amountBorrowed, uint256 profit)',
  'event FlashLoanInitiated(address indexed asset, uint256 amount)',
];

class ArbExecutor {
  /**
   * @param {ethers.Wallet}  wallet          Signing wallet
   * @param {string}         contractAddress  Deployed FlashLoanArbitrageV3 address
   * @param {object}         chainConfig      From engine/config.js
   */
  constructor(wallet, contractAddress, chainConfig) {
    this.wallet     = wallet;
    this.chainConfig = chainConfig;
    this.contract   = new ethers.Contract(contractAddress, ARB_CONTRACT_ABI, wallet);
  }

  /**
   * Encode ArbParams struct for the contract.
   */
  encodeArbParams(params) {
    const abiCoder = new ethers.AbiCoder();
    return abiCoder.encode(
      [
        'tuple(uint8 dex1, uint8 dex2, address tokenBorrow, address tokenIntermediate, ' +
        'uint24 fee1, uint24 fee2, address curvePool1, address curvePool2, ' +
        'int128 curveI1, int128 curveJ1, int128 curveI2, int128 curveJ2, ' +
        'uint256 amountOutMin1, uint256 amountOutMin2)',
      ],
      [params]
    );
  }

  /**
   * Estimate gas for a trade and add a safety buffer.
   */
  async estimateGas(asset, amount, arbParams) {
    const estimate = await this.contract.executeArbitrage.estimateGas(
      asset,
      amount,
      arbParams
    );
    return (estimate * 130n) / 100n; // +30% buffer
  }

  /**
   * Execute an arbitrage trade.
   * @param {object} opportunity  From PoolScanner.findArbitrageOpportunities
   * @param {bigint} loanAmount   Amount to borrow in wei
   * @param {object} arbParamsObj Raw ArbParams fields
   * @returns {ethers.TransactionReceipt}
   */
  async execute(opportunity, loanAmount, arbParamsObj) {
    const encoded  = this.encodeArbParams(arbParamsObj);
    const gasLimit = await this.estimateGas(
      arbParamsObj.tokenBorrow,
      loanAmount,
      encoded
    );

    const feeData  = await this.wallet.provider.getFeeData();
    const tx = await this.contract.executeArbitrage(
      arbParamsObj.tokenBorrow,
      loanAmount,
      encoded,
      {
        gasLimit,
        maxFeePerGas:         feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      }
    );

    console.log(`[executor] tx sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`[executor] confirmed in block ${receipt.blockNumber}`);
    return receipt;
  }
}

module.exports = { ArbExecutor };
