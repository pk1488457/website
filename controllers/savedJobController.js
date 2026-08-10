const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const SavedJob = require('../models/SavedJob');
const Job = require('../models/Job');

// @route   POST /api/v1/saved-jobs/:jobId
// @access  Private (user)
exports.saveJob = asyncHandler(async (req, res, next) => {
  const job = await Job.findById(req.params.jobId);
  if (!job) {
    return next(new ErrorResponse('Job not found', 404));
  }

  const existing = await SavedJob.findOne({ user: req.user.id, job: job._id });
  if (existing) {
    return next(new ErrorResponse('Job is already saved', 400));
  }

  const savedJob = await SavedJob.create({ user: req.user.id, job: job._id });
  await Job.updateOne({ _id: job._id }, { $inc: { savedByCount: 1 } });

  res.status(201).json({ success: true, data: savedJob });
});

// @route   DELETE /api/v1/saved-jobs/:jobId
// @access  Private (user)
exports.unsaveJob = asyncHandler(async (req, res, next) => {
  const savedJob = await SavedJob.findOneAndDelete({ user: req.user.id, job: req.params.jobId });

  if (!savedJob) {
    return next(new ErrorResponse('This job is not in your saved list', 404));
  }

  await Job.updateOne({ _id: req.params.jobId }, { $inc: { savedByCount: -1 } });

  res.status(200).json({ success: true, data: {} });
});

// @route   GET /api/v1/saved-jobs
// @access  Private (user)
exports.getSavedJobs = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const skip = (page - 1) * limit;

  const savedJobs = await SavedJob.find({ user: req.user.id })
    .sort('-createdAt')
    .skip(skip)
    .limit(limit)
    .populate({
      path: 'job',
      populate: { path: 'company', select: 'name logo slug' },
    });

  const total = await SavedJob.countDocuments({ user: req.user.id });

  res.status(200).json({
    success: true,
    count: savedJobs.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: savedJobs,
  });
});
