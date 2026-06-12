// backend/services/zohoMailer.js
//
// Kept for backward compatibility — anything that does
// require('../services/zohoMailer') continues to work.
//
// Uses Gmail SMTP with credentials from .env:
//   EMAIL_USER=systempulse.ds@gmail.com
//   EMAIL_PASS=your_app_password   (Gmail App Password, not your normal password)

const nodemailer = require('nodemailer');

const EMAIL = process.env.EMAIL_USER;
const PASSWORD = process.env.EMAIL_PASS;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: EMAIL,
    pass: PASSWORD
  },
  tls: {
    rejectUnauthorized: false
  }
});

const sendEmail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from: `"Kuiper CRM" <${EMAIL}>`,
      to,
      subject,
      html
    });

    console.log('EMAIL SENT:', info.messageId);
    return info;
  } catch (error) {
    console.error('EMAIL ERROR:', error.message);
    throw error;
  }
};

module.exports = sendEmail;