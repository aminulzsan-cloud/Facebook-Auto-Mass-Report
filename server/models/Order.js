const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    crypto: {
      type: String,
      required: true,
      enum: ['BTC', 'ETH', 'USDT', 'LTC'],
    },
    amount: {
      type: Number,
      required: true,
    },
    cryptoAmount: {
      type: String,
      default: '',
    },
    walletAddress: {
      type: String,
      required: true,
    },
    txHash: {
      type: String,
      default: '',
    },
    blockchainStatus: {
      type: String,
      enum: ['pending', 'detected', 'confirmed', 'not_found', 'error'],
      default: 'pending',
    },
    blockchainConfirmations: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: [
        'pending_payment',
        'payment_submitted',
        'verified',
        'approved',
        'delivered',
        'rejected',
      ],
      default: 'pending_payment',
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    downloadToken: {
      type: String,
      default: '',
    },
    downloadExpiry: {
      type: Date,
    },
    downloadCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ email: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
