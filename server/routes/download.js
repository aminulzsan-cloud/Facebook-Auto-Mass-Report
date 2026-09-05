const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const Order = require('../models/Order');
const { verifyToken } = require('../services/downloadToken');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

/**
 * GET /api/download/:token
 * Validate signed download token, check expiry, serve the tool file.
 */
router.get('/:token', async (req, res) => {
  try {
    // Verify JWT token
    let decoded;
    try {
      decoded = verifyToken(req.params.token);
    } catch (err) {
      return res.status(401).json({
        error: 'Invalid or expired download link.',
        message: 'Please contact support on Telegram @aminulzisan for a new link.',
      });
    }

    // Find order
    const order = await Order.findById(decoded.orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Check if order is approved/delivered
    if (order.status !== 'approved' && order.status !== 'delivered') {
      return res.status(403).json({ error: 'This order has not been approved for download.' });
    }

    // Check expiry
    if (order.downloadExpiry && new Date() > order.downloadExpiry) {
      return res.status(410).json({
        error: 'Download link has expired.',
        message: 'Contact support on Telegram @aminulzisan for a new download link.',
      });
    }

    // Find the tool file in uploads directory
    if (!fs.existsSync(UPLOADS_DIR)) {
      return res.status(500).json({ error: 'Download file not available. Contact support.' });
    }

    const files = fs.readdirSync(UPLOADS_DIR).filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return ['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext);
    });

    if (files.length === 0) {
      return res.status(500).json({ error: 'Download file not available. Contact support.' });
    }

    // Serve the first matching file
    const filePath = path.join(UPLOADS_DIR, files[0]);

    // Update order
    order.status = 'delivered';
    order.downloadCount = (order.downloadCount || 0) + 1;
    await order.save();

    // Send file
    res.download(filePath, `${order.crypto}_tool_${Date.now()}${path.extname(files[0])}`);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Download failed. Contact support.' });
  }
});

module.exports = router;
