const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const config = require('./config');

const ordersRouter = require('./routes/orders');
const adminRouter = require('./routes/admin');
const reviewsRouter = require('./routes/reviews');
const downloadRouter = require('./routes/download');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api/orders', ordersRouter);
app.use('/api/admin', adminRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/download', downloadRouter);

// Serve storefront for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
});

// Connect to MongoDB and start server
mongoose
  .connect(config.mongoUri)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    app.listen(config.port, () => {
      console.log(`🚀 Store running at ${config.baseUrl}`);
      console.log(`🔧 Admin panel at ${config.baseUrl}/admin.html`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

module.exports = app;
