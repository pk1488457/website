const crypto = require('crypto');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');

// Builds the cookie + JSON response that ships an access token to the
// client. Centralized here so register/login/refresh all behave identically.
const sendTokenResponse = (user, statusCode, res) => {
  const token = user.getSignedJwtToken();

  const cookieOptions = {
    expires: new Date(Date.now() + (process.env.JWT_COOKIE_EXPIRE || 7) * 24 * 60 * 60 * 1000),
    httpOnly: true, // not accessible via client-side JS, mitigates XSS token theft
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  };

  res
    .status(statusCode)
    .cookie('token', token, cookieOptions)
    .json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        isEmailVerified: user.isEmailVerified,
      },
    });
};

// @route   POST /api/v1/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res, next) => {
  const { name, email, password, role, phone } = req.body;

  // Prevent self-registration as admin - admin accounts must be created
  // by an existing admin via the admin panel, not through the public form.
  const safeRole = role === 'employer' ? 'employer' : 'user';

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new ErrorResponse('An account with this email already exists', 400));
  }

  const user = await User.create({ name, email, password, role: safeRole, phone });

  const verificationToken = crypto.randomBytes(20).toString('hex');
  user.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
  user.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000;
  await user.save();

  // NOTE: actual email sending is wired up in utils/sendEmail.js once SMTP
  // credentials are provided. Without them the token is generated but not
  // emailed - fine for local dev, but flagged here so it isn't mistaken for
  // a finished feature.

  sendTokenResponse(user, 201, res);
});

// @route   POST /api/v1/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ErrorResponse('Please provide an email and password', 400));
  }

  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  if (user.isLocked()) {
    const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
    return next(
      new ErrorResponse(`Account locked due to too many failed attempts. Try again in ${minutesLeft} minute(s)`, 423)
    );
  }

  if (!user.isActive) {
    return next(new ErrorResponse('This account has been deactivated', 401));
  }

  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    await user.incLoginAttempts();
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  await user.resetLoginAttempts();

  sendTokenResponse(user, 200, res);
});

// @route   GET /api/v1/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res, next) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

// @route   GET /api/v1/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  res.status(200).json({ success: true, data: user });
});

// @route   PUT /api/v1/auth/updatepassword
// @access  Private
exports.updatePassword = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('+password');

  const isMatch = await user.matchPassword(req.body.currentPassword);
  if (!isMatch) {
    return next(new ErrorResponse('Current password is incorrect', 401));
  }

  user.password = req.body.newPassword;
  await user.save();

  sendTokenResponse(user, 200, res);
});

// @route   POST /api/v1/auth/forgotpassword
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  // Deliberately return the same success message whether or not the
  // email exists, so this endpoint can't be used to enumerate registered
  // email addresses.
  if (!user) {
    return res.status(200).json({
      success: true,
      message: 'If that email is registered, a reset link has been sent',
    });
  }

  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  // Email delivery wired via utils/sendEmail.js - requires SMTP env vars.
  // resetToken would be embedded in a URL like:
  // `${process.env.CLIENT_URL}/reset-password/${resetToken}`

  res.status(200).json({
    success: true,
    message: 'If that email is registered, a reset link has been sent',
    // resetToken is only ever included in the response during local dev
    // with no SMTP configured, so you can test the flow without email set up.
    ...(process.env.NODE_ENV === 'development' && !process.env.SMTP_HOST
      ? { devResetToken: resetToken }
      : {}),
  });
});

// @route   PUT /api/v1/auth/resetpassword/:resettoken
// @access  Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(req.params.resettoken)
    .digest('hex');

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    return next(new ErrorResponse('Invalid or expired reset token', 400));
  }

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  sendTokenResponse(user, 200, res);
});
