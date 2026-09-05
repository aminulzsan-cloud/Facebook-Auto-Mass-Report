const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Generate a signed download token for a given order ID.
 * Token expires in 24 hours.
 */
function generateToken(orderId) {
  return jwt.sign(
    { orderId: orderId.toString(), purpose: 'download' },
    config.downloadSecret,
    { expiresIn: '24h' }
  );
}

/**
 * Verify a download token and return the decoded payload.
 * Returns { orderId } on success, throws on failure.
 */
function verifyToken(token) {
  const decoded = jwt.verify(token, config.downloadSecret);
  if (decoded.purpose !== 'download') {
    throw new Error('Invalid token purpose');
  }
  return { orderId: decoded.orderId };
}

module.exports = { generateToken, verifyToken };
