// Custom error class so controllers can throw errors with an explicit
// HTTP status code, instead of every error defaulting to 500.
class ErrorResponse extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = ErrorResponse;
