const { BLOCKED_MESSAGE, isLoginBlocked, settleScheduledBlock } = require('../utils/accessBlock');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 2. Login Logic
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid Credentials" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid Credentials" });
    }

    // Blocked accounts (left the company, suspended) cannot sign in
    if (isLoginBlocked(user)) {
      await settleScheduledBlock(User, user);
      return res.status(403).json({ error: BLOCKED_MESSAGE, code: 'ACCOUNT_BLOCKED' });
    }

    // Generate Token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'your_fallback_secret',
      { expiresIn: '12h' }
    );
    let organizationId = null;
    if (user.organizationId) {
      organizationId = typeof user.organizationId === 'object' 
        ? user.organizationId._id.toString() 
        : user.organizationId.toString();
    }
    // Send Response
    res.json({
      token,
      user: { 
        id: user._id, 
        name: user.name, 
        role: user.role 
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// 3. Export both
module.exports = { login, };