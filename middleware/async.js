// Wraps an async controller function so any thrown error or rejected
// promise is passed to Express's error handler via next(), instead of
// requiring a try/catch block in every single controller function.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
