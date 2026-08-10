const ErrorResponse = require('../utils/errorResponse');

// Single place where every error in the app ends up. Converts known
// Mongoose/JWT error types into clean, predictable API responses instead
// of leaking stack traces or raw driver errors to the client.
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Mongoose bad ObjectId (CastError)
  if (err.name === 'CastError') {
    error = new ErrorResponse(`Resource not found with id of ${err.value}`, 404);
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error = new ErrorResponse(`Duplicate value entered for field: ${field}`, 400);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((val) => val.message);
    error = new ErrorResponse(message.join(', '), 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new ErrorResponse('Invalid token. Please log in again.', 401);
  }
  if (err.name === 'TokenExpiredError') {
    error = new ErrorResponse('Your session has expired. Please log in again.', 401);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error',
  });
};

module.exports = errorHandler;
