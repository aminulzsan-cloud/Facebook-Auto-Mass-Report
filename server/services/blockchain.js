const axios = require('axios');
const config = require('../config');

const BLOCKCYPHER_BASE = 'https://api.blockcypher.com/v1';

// Map our crypto codes to Blockcypher chain/coin format
const CHAIN_MAP = {
  BTC: { coin: 'btc', chain: 'main' },
  LTC: { coin: 'ltc', chain: 'main' },
  ETH: { coin: 'eth', chain: 'main' },
};

/**
 * Check a transaction on the blockchain via Blockcypher API.
 * Returns { found, confirmations, amount, status }
 */
async function checkTransaction(crypto, txHash) {
  // USDT (TRC-20) is not supported by Blockcypher — manual verification
  if (crypto === 'USDT') {
    return {
      found: false,
      confirmations: 0,
      amount: null,
      status: 'manual_check',
      message: 'USDT (TRC-20) requires manual verification via Tronscan',
      tronscanUrl: `https://tronscan.org/#/transaction/${txHash}`,
    };
  }

  const chainInfo = CHAIN_MAP[crypto];
  if (!chainInfo) {
    return {
      found: false,
      confirmations: 0,
      amount: null,
      status: 'unsupported',
      message: `Unsupported crypto: ${crypto}`,
    };
  }

  try {
    const url = `${BLOCKCYPHER_BASE}/${chainInfo.coin}/${chainInfo.chain}/txs/${txHash}`;
    const params = config.blockcypherToken
      ? { token: config.blockcypherToken }
      : {};

    const response = await axios.get(url, { params, timeout: 10000 });
    const tx = response.data;

    const confirmations = tx.confirmations || 0;
    let totalOutput = 0;

    if (crypto === 'ETH') {
      // ETH amounts are in wei
      totalOutput = tx.total ? tx.total / 1e18 : 0;
    } else {
      // BTC/LTC amounts are in satoshis
      totalOutput = tx.total ? tx.total / 1e8 : 0;
    }

    let status = 'detected';
    if (confirmations >= 1) status = 'confirmed';
    if (confirmations >= 6 && crypto === 'BTC') status = 'confirmed';
    if (confirmations >= 12 && crypto === 'ETH') status = 'confirmed';
    if (confirmations >= 6 && crypto === 'LTC') status = 'confirmed';

    return {
      found: true,
      confirmations,
      amount: totalOutput,
      status,
      receivedAt: tx.received || tx.confirmed || null,
      blockHeight: tx.block_height || null,
    };
  } catch (err) {
    if (err.response && err.response.status === 404) {
      return {
        found: false,
        confirmations: 0,
        amount: null,
        status: 'not_found',
        message: 'Transaction not found on the blockchain',
      };
    }

    return {
      found: false,
      confirmations: 0,
      amount: null,
      status: 'error',
      message: err.message || 'Failed to check blockchain',
    };
  }
}

module.exports = { checkTransaction };
