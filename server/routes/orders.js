const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const config = require('../config');
const { checkTransaction } = require('../services/blockchain');
const { sendAdminNotification } = require('../services/mailer');

/**
 * POST /api/orders
 * Create a new order. Buyer provides email + crypto choice.
 */
router.post('/', async (req, res) => {
  try {
    const { email, crypto } = req.body;

    if (!email || !crypto) {
      return res.status(400).json({ error: 'Email and crypto type are required.' });
    }

    const validCryptos = ['BTC', 'ETH', 'USDT', 'LTC'];
    if (!validCryptos.includes(crypto)) {
      return res.status(400).json({ error: `Invalid crypto. Choose from: ${validCryptos.join(', ')}` });
    }

    const walletAddress = config.wallets[crypto];
    if (!walletAddress || walletAddress.includes('_placeholder')) {
      return res.status(500).json({ error: 'Wallet address not configured for this cryptocurrency.' });
    }

    const order = await Order.create({
      email,
      crypto,
      amount: config.product.price,
      walletAddress,
      status: 'pending_payment',
    });

    // Notify admin (fire and forget)
    sendAdminNotification({
      email,
      crypto,
      amount: config.product.price,
      orderId: order._id,
    });

    res.status(201).json({
      orderId: order._id,
      walletAddress,
      amount: config.product.price,
      crypto,
      message: `Send $${config.product.price} worth of ${crypto} to the wallet address below, then submit your transaction hash.`,
    });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Failed to create order.' });
  }
});

/**
 * PUT /api/orders/:id/tx
 * Submit the transaction hash after sending payment.
 * Auto-checks blockchain for confirmation.
 */
router.put('/:id/tx', async (req, res) => {
  try {
    const { txHash } = req.body;

    if (!txHash || txHash.trim().length < 10) {
      return res.status(400).json({ error: 'A valid transaction hash is required.' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (order.status !== 'pending_payment' && order.status !== 'payment_submitted') {
      return res.status(400).json({ error: 'Order is not awaiting payment.' });
    }

    order.txHash = txHash.trim();
    order.status = 'payment_submitted';

    // Auto-check blockchain
    try {
      const result = await checkTransaction(order.crypto, order.txHash);
      order.blockchainStatus = result.status;
      order.blockchainConfirmations = result.confirmations || 0;
      if (result.status === 'confirmed') {
        order.status = 'verified';
      }
    } catch (bcErr) {
      console.error('Blockchain check failed:', bcErr.message);
      order.blockchainStatus = 'pending';
    }

    await order.save();

    // Notify admin
    sendAdminNotification({
      email: order.email,
      crypto: order.crypto,
      amount: order.amount,
      orderId: order._id,
      txHash: order.txHash,
    });

    res.json({
      orderId: order._id,
      status: order.status,
      blockchainStatus: order.blockchainStatus,
      confirmations: order.blockchainConfirmations,
      message: 'Transaction hash submitted. We will verify your payment shortly.',
    });
  } catch (err) {
    console.error('Submit TX error:', err);
    res.status(500).json({ error: 'Failed to submit transaction hash.' });
  }
});

/**
 * GET /api/orders/:id/status
 * Check order status (for frontend polling). Re-checks blockchain if needed.
 */
router.get('/:id/status', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Re-check blockchain if payment was submitted but not yet confirmed
    if (
      order.txHash &&
      order.blockchainStatus !== 'confirmed' &&
      !['approved', 'delivered', 'rejected'].includes(order.status)
    ) {
      try {
        const result = await checkTransaction(order.crypto, order.txHash);
        order.blockchainStatus = result.status;
        order.blockchainConfirmations = result.confirmations || 0;
        if (result.status === 'confirmed' && order.status === 'payment_submitted') {
          order.status = 'verified';
        }
        await order.save();
      } catch (bcErr) {
        console.error('Re-check blockchain failed:', bcErr.message);
      }
    }

    const response = {
      orderId: order._id,
      status: order.status,
      blockchainStatus: order.blockchainStatus,
      confirmations: order.blockchainConfirmations,
      crypto: order.crypto,
      amount: order.amount,
      createdAt: order.createdAt,
    };

    if (order.status === 'approved' || order.status === 'delivered') {
      response.downloadReady = true;
    }

    if (order.status === 'rejected') {
      response.rejectionReason = order.rejectionReason;
    }

    res.json(response);
  } catch (err) {
    console.error('Check status error:', err);
    res.status(500).json({ error: 'Failed to check order status.' });
  }
});

/**
 * GET /api/orders/config/wallets
 * Public endpoint — returns configured wallet addresses and price.
 */
router.get('/config/wallets', (req, res) => {
  const wallets = {};
  for (const [key, val] of Object.entries(config.wallets)) {
    if (!val.includes('_placeholder')) {
      wallets[key] = val;
    }
  }

  res.json({
    wallets,
    price: config.product.price,
    productName: config.product.name,
  });
});

module.exports = router;
