const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'opti-graphql-secret-change-in-production';

// Verify JWT token middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access denied. No token provided.' 
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Add user info to request
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired token.' 
    });
  }
};

// Check if user has required role
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required.' 
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}` 
      });
    }

    next();
  };
};

// Check if user can send specific command
const canSendCommand = (req, res, next) => {
  const { commandType } = req.body;
  const userRole = req.user.role;

  // viewer: cannot send any commands
  if (userRole === 'viewer') {
    return res.status(403).json({
      success: false,
      message: 'Viewers cannot send commands. Contact admin for access.'
    });
  }

  // operator: can only send location requests
  if (userRole === 'operator') {
    if (commandType !== 'request_location' && commandType !== 'location_request') {
      return res.status(403).json({
        success: false,
        message: 'Operators can only send location requests. Lock/unlock requires admin access.'
      });
    }
  }

  // admin and super_admin: can send all commands
  next();
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required.' 
    });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin access required for this operation.' 
    });
  }

  next();
};

module.exports = {
  verifyToken,
  checkRole,
  canSendCommand,
  isAdmin,
  JWT_SECRET
};
