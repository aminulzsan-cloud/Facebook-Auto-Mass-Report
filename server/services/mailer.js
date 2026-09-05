const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  }
  return transporter;
}

/**
 * Send download email to the buyer after admin approves the order.
 */
async function sendDownloadEmail(email, downloadUrl, orderDetails) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#1b1b18;font-family:'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#272724;border-radius:8px;overflow:hidden;">
    
    <div style="background:#e96648;padding:40px 35px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:28px;letter-spacing:2px;">🚀 PURCHASE CONFIRMED</h1>
      <p style="margin:10px 0 0;color:rgba(255,255,255,.85);font-size:13px;">Your order has been approved!</p>
    </div>
    
    <div style="padding:35px;">
      <p style="color:#aaa9a3;font-size:14px;line-height:1.8;margin:0 0 20px;">
        Hey there! Your payment for <strong style="color:#fff;">${config.product.name}</strong> has been verified and approved.
      </p>
      
      <div style="background:#1b1b18;border-radius:6px;padding:20px;margin:20px 0;">
        <p style="margin:0 0 5px;color:#716d65;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Order Details</p>
        <p style="margin:5px 0;color:#fff;font-size:13px;">📧 Email: ${email}</p>
        <p style="margin:5px 0;color:#fff;font-size:13px;">💰 Amount: $${orderDetails.amount} (${orderDetails.crypto})</p>
        <p style="margin:5px 0;color:#fff;font-size:13px;">🆔 Order: ${orderDetails.orderId}</p>
      </div>
      
      <div style="text-align:center;margin:30px 0;">
        <a href="${downloadUrl}" 
           style="display:inline-block;background:#e96648;color:#fff;padding:16px 45px;border-radius:4px;font-size:14px;font-weight:bold;text-decoration:none;letter-spacing:1px;">
          ⬇ DOWNLOAD YOUR TOOL
        </a>
      </div>
      
      <div style="background:rgba(233,102,72,.1);border:1px solid rgba(233,102,72,.25);border-radius:6px;padding:15px;margin:20px 0;">
        <p style="margin:0;color:#e96648;font-size:12px;font-weight:bold;">⚠️ Important</p>
        <p style="margin:5px 0 0;color:#aaa9a3;font-size:11px;line-height:1.7;">
          This download link expires in <strong style="color:#fff;">24 hours</strong>. 
          If you need a new link, contact us on Telegram: <a href="https://t.me/aminulzisan" style="color:#e96648;">@aminulzisan</a>
        </p>
      </div>
      
      <p style="color:#aaa9a3;font-size:12px;line-height:1.7;margin:25px 0 0;">
        Need help with setup? We're here for you! Reach out on 
        <a href="https://t.me/aminulzisan" style="color:#e96648;">Telegram</a> 
        for instant support.
      </p>
    </div>
    
    <div style="border-top:1px solid rgba(255,255,255,.08);padding:20px 35px;text-align:center;">
      <p style="margin:0;color:#716d65;font-size:9px;">© 2026 ${config.product.name}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

  const mailOptions = {
    from: `"${config.product.name}" <${config.smtp.user}>`,
    to: email,
    subject: `✅ Your ${config.product.name} is ready to download!`,
    html,
  };

  return getTransporter().sendMail(mailOptions);
}

/**
 * Send a notification email to admin when a new order is placed.
 */
async function sendAdminNotification(orderDetails) {
  if (!config.smtp.user) return;

  const html = `
<div style="font-family:sans-serif;padding:20px;">
  <h2>🔔 New Order Received</h2>
  <p><strong>Email:</strong> ${orderDetails.email}</p>
  <p><strong>Crypto:</strong> ${orderDetails.crypto}</p>
  <p><strong>Amount:</strong> $${orderDetails.amount}</p>
  <p><strong>Order ID:</strong> ${orderDetails.orderId}</p>
  <p><strong>TX Hash:</strong> ${orderDetails.txHash || 'Not yet submitted'}</p>
  <p><a href="${config.baseUrl}/admin.html">Go to Admin Panel →</a></p>
</div>`;

  const mailOptions = {
    from: `"Store Notifications" <${config.smtp.user}>`,
    to: config.smtp.user,
    subject: `🔔 New order from ${orderDetails.email}`,
    html,
  };

  try {
    await getTransporter().sendMail(mailOptions);
  } catch (err) {
    console.error('Failed to send admin notification:', err.message);
  }
}

module.exports = { sendDownloadEmail, sendAdminNotification };
