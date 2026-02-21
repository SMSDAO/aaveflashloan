// engine/flashbots.js – Flashbots bundle submission helper (Ethereum mainnet only)
'use strict';

const { ethers }   = require('ethers');
const { fetchJson } = require('ethers');

const FLASHBOTS_RPC = 'https://relay.flashbots.net';

/**
 * FlashbotsProvider wraps a standard provider and adds bundle submission
 * to the Flashbots relay via the eth_sendBundle JSON-RPC method.
 *
 * Only available on Ethereum mainnet (chainId 1).
 */
class FlashbotsProvider {
  /**
   * @param {ethers.Provider} provider   Underlying JSON-RPC provider.
   * @param {ethers.Wallet}   authSigner Wallet used to sign Flashbots requests.
   */
  constructor(provider, authSigner) {
    this.provider   = provider;
    this.authSigner = authSigner;
  }

  /**
   * Sign and submit a bundle to the Flashbots relay.
   *
   * @param {string[]} signedTxs   Array of signed raw transactions.
   * @param {number}   targetBlock Block number to target.
   * @returns {Promise<object>}   Flashbots relay response.
   */
  async sendBundle(signedTxs, targetBlock) {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id:      '1',
      method:  'eth_sendBundle',
      params:  [
        {
          txs:         signedTxs,
          blockNumber: ethers.toBeHex(targetBlock),
        },
      ],
    });

    const signature = await this.authSigner.signMessage(ethers.id(body));
    const headers   = {
      'Content-Type':         'application/json',
      'X-Flashbots-Signature': `${await this.authSigner.getAddress()}:${signature}`,
    };

    const response = await fetch(FLASHBOTS_RPC, {
      method:  'POST',
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(`Flashbots relay error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Simulate a bundle without submitting it.
   */
  async simulate(signedTxs, blockNumber) {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id:      '1',
      method:  'eth_callBundle',
      params:  [
        {
          txs:              signedTxs,
          blockNumber:      ethers.toBeHex(blockNumber),
          stateBlockNumber: 'latest',
        },
      ],
    });

    const signature = await this.authSigner.signMessage(ethers.id(body));
    const headers   = {
      'Content-Type':         'application/json',
      'X-Flashbots-Signature': `${await this.authSigner.getAddress()}:${signature}`,
    };

    const response = await fetch(FLASHBOTS_RPC, {
      method:  'POST',
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(`Flashbots simulate error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}

module.exports = { FlashbotsProvider };
