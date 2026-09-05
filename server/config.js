require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/fb-report-store',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',

  admin: {
    user: process.env.ADMIN_USER || 'admin',
    pass: process.env.ADMIN_PASS || 'admin123',
  },

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },

  wallets: {
    BTC: process.env.WALLET_BTC || 'bc1q_placeholder',
    ETH: process.env.WALLET_ETH || '0x_placeholder',
    USDT: process.env.WALLET_USDT || 'T_placeholder',
    LTC: process.env.WALLET_LTC || 'ltc1q_placeholder',
  },

  blockcypherToken: process.env.BLOCKCYPHER_TOKEN || '',
  downloadSecret: process.env.DOWNLOAD_SECRET || 'download-secret-change-me',

  product: {
    price: parseFloat(process.env.PRODUCT_PRICE) || 49,
    name: process.env.PRODUCT_NAME || 'Facebook Mass Report Tool',
  },
};
