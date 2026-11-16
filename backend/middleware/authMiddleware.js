const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { BLOCKED_MESSAGE, isLoginBlocked, settleScheduledBlock } = require('../utils/accessBlock');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_fallback_secret');

      // Attach user to request (excluding password)
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      // Blocked accounts are signed out immediately, even with a valid token
      if (isLoginBlocked(req.user)) {
        await settleScheduledBlock(User, req.user);
        return res.status(401).json({ message: BLOCKED_MESSAGE, error: BLOCKED_MESSAGE, code: 'ACCOUNT_BLOCKED' });
      }
    } catch (error) {
      return res.status(401).json({ message: "Not authorized, token failed" });
    }
    return next();
  }

  if (!token) {
   return res.status(401).json({ message: "Not authorized, no token" });
  }
};

module.exports = { protect };