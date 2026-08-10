const jwt = require('jsonwebtoken');
const asyncHandler = require('./async');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');

// Protects routes: requires a valid access token, either from the
// Authorization header (Bearer) or an httpOnly cookie. Attaches the
// authenticated user to req.user for downstream controllers.
exports.protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new ErrorResponse('User belonging to this token no longer exists', 401));
    }
    if (!user.isActive) {
      return next(new ErrorResponse('This account has been deactivated', 401));
    }

    req.user = user;
    next();
  } catch (err) {
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }
});

// Restricts a route to specific roles, e.g. authorize('admin') or
// authorize('employer', 'admin'). Must run after protect().
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorResponse(`Role '${req.user.role}' is not authorized to access this route`, 403)
      );
    }
    next();
  };
};
