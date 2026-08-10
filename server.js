const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');

dotenv.config();

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

connectDB();

const app = express();

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Security headers
app.use(helmet());

// CORS - restricted to configured client URL, not wide open
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5000',
    credentials: true,
  })
);

// Sanitize data against NoSQL injection ($ and . operator injection)
app.use(mongoSanitize());

// Sanitize user input against XSS
app.use(xss());

// Gzip compression for faster responses
app.use(compression());

// Request logging (dev only, to keep production logs clean)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Global rate limiter - prevents brute force / abuse across all routes.
// Stricter limits are applied separately on auth routes (see routes/auth.js).
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 200,
  message: { success: false, error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalLimiter);

// Static files (uploaded resumes, profile photos, company logos)
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- API ROUTES ----------
// Each route module is mounted here as it's built out.
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/jobs', require('./routes/jobs'));
app.use('/api/v1/companies', require('./routes/companies'));
app.use('/api/v1/applications', require('./routes/applications'));
app.use('/api/v1/saved-jobs', require('./routes/savedJobs'));
app.use('/api/v1/resumes', require('./routes/resumes'));
// app.use('/api/v1/users', require('./routes/users'));
// app.use('/api/v1/admin', require('./routes/admin'));

// Health check
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({ success: true, message: 'API is running' });
});

// 404 handler for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.originalUrl} not found` });
});

// Centralized error handler - must be the LAST middleware registered
app.use(errorHandler);

const PORT = process.env.PORT || 3333;

const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Catch unhandled promise rejections so the process fails loudly instead
// of hanging in a broken state.
process.on('unhandledRejection', (err) => {
  console.error(`Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});

module.exports = app;
