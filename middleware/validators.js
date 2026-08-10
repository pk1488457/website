const { body, validationResult } = require('express-validator');
const ErrorResponse = require('../utils/errorResponse');

// Runs after the validator chains below and turns any failures into a
// single clean 400 response instead of letting bad data reach controllers.
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors.array().map((e) => e.msg).join(', ');
    return next(new ErrorResponse(message, 400));
  }
  next();
};

exports.registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 50 }),
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/\d/)
    .withMessage('Password must contain at least one number'),
  body('role').optional().isIn(['user', 'employer']).withMessage('Invalid role'),
];

exports.loginRules = [
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

exports.forgotPasswordRules = [
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
];

exports.resetPasswordRules = [
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

exports.updatePasswordRules = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/\d/)
    .withMessage('New password must contain at least one number'),
];

exports.createJobRules = [
  body('title').trim().notEmpty().withMessage('Job title is required').isLength({ max: 120 }),
  body('company').optional().isMongoId().withMessage('Invalid company id'),
  body('description').trim().notEmpty().withMessage('Job description is required'),
  body('jobType')
    .isIn(['full-time', 'part-time', 'contract', 'internship', 'freelance'])
    .withMessage('Invalid job type'),
  body('experienceMin').optional().isNumeric().withMessage('experienceMin must be a number'),
  body('experienceMax').optional().isNumeric().withMessage('experienceMax must be a number'),
  body('salaryMin').optional().isNumeric().withMessage('salaryMin must be a number'),
  body('salaryMax').optional().isNumeric().withMessage('salaryMax must be a number'),
];

exports.updateJobRules = [
  body('title').optional().trim().isLength({ max: 120 }),
  body('jobType')
    .optional()
    .isIn(['full-time', 'part-time', 'contract', 'internship', 'freelance'])
    .withMessage('Invalid job type'),
];

exports.createCompanyRules = [
  body('name').trim().notEmpty().withMessage('Company name is required').isLength({ max: 100 }),
  body('website')
    .optional({ checkFalsy: true })
    .matches(/^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/)
    .withMessage('Please enter a valid URL'),
  body('companySize')
    .optional()
    .isIn(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'])
    .withMessage('Invalid company size'),
];
