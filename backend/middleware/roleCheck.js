/**
 * Flexible Role Middleware
 * Usage: authorize('Admin', 'Sales', 'Project Manager')
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // 1. Check if user exists (set by your authMiddleware/JWT verify)
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized: No user found" });
    }

    // 2. Check if the user's role is in the allowed list
    if (allowedRoles.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({ 
        message: `Access Denied: ${req.user.role} role does not have permission.` 
      });
    }
  };
};

module.exports = { authorize };