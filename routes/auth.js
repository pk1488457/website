const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const {
  register,
  login,
  logout,
  getMe,
  updatePassword,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');

const { protect } = require('../middleware/auth');
const {
  validate,
  registerRules,
  loginRules,
  forgotPasswordRules,
  resetPasswordRules,
  updatePasswordRules,
} = require('../middleware/validators');

// Stricter limiter specifically for login/register/forgot-password -
// these are the endpoints brute-force and credential-stuffing attacks
// target, so they get a tighter cap than the general API rate limit.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', authLimiter, registerRules, validate, register);
router.post('/login', authLimiter, loginRules, validate, login);
router.get('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/updatepassword', protect, updatePasswordRules, validate, updatePassword);
router.post('/forgotpassword', authLimiter, forgotPasswordRules, validate, forgotPassword);
router.put('/resetpassword/:resettoken', resetPasswordRules, validate, resetPassword);

module.exports = router;
