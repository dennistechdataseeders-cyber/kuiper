// backend/middleware/roleCheck.js
/**
 * Flexible Role Middleware
 * Usage: authorize('Admin', 'Super Admin', 'Sales', 'Project Manager')
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized: No user found" });
    }

    // Super Admin has ALL access - they bypass all role checks
    if (req.user.role === 'Super Admin') {
      return next();
    }

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