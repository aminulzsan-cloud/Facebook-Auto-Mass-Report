const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Order = require('../models/Order');
const config = require('../config');
const adminAuth = require('../middleware/adminAuth');
const { checkTransaction } = require('../services/blockchain');
const { generateToken } = require('../services/downloadToken');
const { sendDownloadEmail } = require('../services/mailer');

/**
 * POST /api/admin/login
 * Authenticate admin with hardcoded credentials, returns JWT.
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (username === config.admin.user && password === config.admin.pass) {
    const token = jwt.sign({ role: 'admin', user: username }, config.jwtSecret, {
      expiresIn: '12h',
    });
    return res.json({ token, message: 'Login successful' });
  }

  res.status(401).json({ error: 'Invalid credentials' });
});

/**
 * GET /api/admin/stats
 * Dashboard statistics.
 */
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const [total, pending, submitted, verified, approved, delivered, rejected] =
      await Promise.all([
        Order.countDocuments(),
        Order.countDocuments({ status: 'pending_payment' }),
        Order.countDocuments({ status: 'payment_submitted' }),
        Order.countDocuments({ status: 'verified' }),
        Order.countDocuments({ status: 'approved' }),
        Order.countDocuments({ status: 'delivered' }),
        Order.countDocuments({ status: 'rejected' }),
      ]);

    // Calculate total revenue from approved + delivered orders
    const revenueResult = await Order.aggregate([
      { $match: { status: { $in: ['approved', 'delivered'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const revenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    res.json({
      total,
      pending,
      submitted,
      verified,
      approved,
      delivered,
      rejected,
      revenue,
      needsAttention: submitted + verified,
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

/**
 * GET /api/admin/orders
 * List all orders, filterable by status.
 */
router.get('/orders', adminAuth, async (req, res) => {
  try {
    const query = {};
    if (req.query.status) {
      query.status = req.query.status;
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(req.query.limit) || 100);

    res.json(orders);
  } catch (err) {
    console.error('List orders error:', err);
    res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

/**
 * GET /api/admin/orders/:id
 * Single order detail with fresh blockchain check.
 */
router.get('/orders/:id', adminAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    let blockchainInfo = null;

    // If there's a TX hash, check blockchain
    if (order.txHash) {
      blockchainInfo = await checkTransaction(order.crypto, order.txHash);

      // Update order's blockchain status
      if (blockchainInfo.status && blockchainInfo.status !== 'error') {
        order.blockchainStatus = blockchainInfo.status;
        order.blockchainConfirmations = blockchainInfo.confirmations || 0;

        // Auto-advance to verified if confirmed on-chain
        if (
          blockchainInfo.status === 'confirmed' &&
          (order.status === 'payment_submitted' || order.status === 'pending_payment')
        ) {
          order.status = 'verified';
        }

        await order.save();
      }
    }

    res.json({
      order,
      blockchainInfo,
    });
  } catch (err) {
    console.error('Order detail error:', err);
    res.status(500).json({ error: 'Failed to fetch order details.' });
  }
});

/**
 * PUT /api/admin/orders/:id/approve
 * Approve order → generate download token → send email with download link.
 */
router.put('/orders/:id/approve', adminAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (order.status === 'approved' || order.status === 'delivered') {
      return res.status(400).json({ error: 'Order has already been approved.' });
    }

    if (order.status === 'rejected') {
      return res.status(400).json({ error: 'Cannot approve a rejected order. Create a new order.' });
    }

    // Generate download token (24h expiry)
    const downloadToken = generateToken(order._id);
    const downloadExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const downloadUrl = `${config.baseUrl}/api/download/${downloadToken}`;

    order.status = 'approved';
    order.downloadToken = downloadToken;
    order.downloadExpiry = downloadExpiry;
    await order.save();

    // Send download email
    try {
      await sendDownloadEmail(order.email, downloadUrl, {
        amount: order.amount,
        crypto: order.crypto,
        orderId: order._id,
      });
      console.log(`📧 Download email sent to ${order.email}`);
    } catch (emailErr) {
      console.error('Email send failed:', emailErr.message);
      // Still mark as approved even if email fails
    }

    res.json({
      message: 'Order approved and download email sent.',
      orderId: order._id,
      downloadUrl,
      downloadExpiry,
    });
  } catch (err) {
    console.error('Approve error:', err);
    res.status(500).json({ error: 'Failed to approve order.' });
  }
});

/**
 * PUT /api/admin/orders/:id/reject
 * Reject an order with an optional reason.
 */
router.put('/orders/:id/reject', adminAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (order.status === 'approved' || order.status === 'delivered') {
      return res.status(400).json({ error: 'Cannot reject an already approved/delivered order.' });
    }

    order.status = 'rejected';
    order.rejectionReason = req.body.reason || 'Payment could not be verified.';
    await order.save();

    res.json({
      message: 'Order rejected.',
      orderId: order._id,
      reason: order.rejectionReason,
    });
  } catch (err) {
    console.error('Reject error:', err);
    res.status(500).json({ error: 'Failed to reject order.' });
  }
});

module.exports = router;
