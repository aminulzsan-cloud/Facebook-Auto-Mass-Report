const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Order = require('../models/Order');

/**
 * GET /api/reviews
 * Get all approved reviews for the storefront.
 */
router.get('/', async (req, res) => {
  try {
    const reviews = await Review.find({ approved: true })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(reviews);
  } catch (err) {
    console.error('Fetch reviews error:', err);
    res.status(500).json({ error: 'Failed to fetch reviews.' });
  }
});

/**
 * POST /api/reviews
 * Submit a review. If orderId is provided and matches a delivered/approved order,
 * the review gets a "verified buyer" badge.
 */
router.post('/', async (req, res) => {
  try {
    const { name, rating, comment, orderId } = req.body;

    if (!name || !rating || !comment) {
      return res.status(400).json({ error: 'Name, rating, and comment are required.' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    }

    let verified = false;

    // Check if orderId belongs to an approved/delivered order
    if (orderId) {
      const order = await Order.findById(orderId);
      if (order && (order.status === 'approved' || order.status === 'delivered')) {
        verified = true;
      }
    }

    // Generate avatar initials from name
    const initials = name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    const review = await Review.create({
      name,
      avatar: initials,
      title: req.body.title || '',
      location: req.body.location || '',
      rating,
      comment,
      verified,
      orderId: orderId || undefined,
    });

    res.status(201).json({
      message: 'Review submitted successfully.',
      review,
    });
  } catch (err) {
    console.error('Submit review error:', err);
    res.status(500).json({ error: 'Failed to submit review.' });
  }
});

module.exports = router;
