const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');

// @route   GET /api/v1/users/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  res.status(200).json({ success: true, data: user });
});

// @route   PUT /api/v1/users/me
// @access  Private
exports.updateMe = asyncHandler(async (req, res, next) => {
  const fieldsToUpdate = {};
  const allowedFields = ['name', 'email', 'phone', 'location', 'headline', 'bio', 'avatar'];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      fieldsToUpdate[field] = req.body[field];
    }
  });

  // If email is changing, ensure uniqueness
  if (fieldsToUpdate.email && fieldsToUpdate.email !== req.user.email) {
    const existing = await User.findOne({ email: fieldsToUpdate.email });
    if (existing) {
      return next(new ErrorResponse('An account with this email already exists', 400));
    }
  }

  const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: user,
  });
});
