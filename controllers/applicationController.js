const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const Application = require('../models/Application');
const Job = require('../models/Job');
const QueryBuilder = require('../utils/queryBuilder');

// @route   POST /api/v1/applications/:jobId
// @access  Private (user)
// Expects multipart/form-data with a 'resume' file field, plus optional
// coverLetter text field. Route wires multer's uploadResume before this.
exports.applyToJob = asyncHandler(async (req, res, next) => {
  const job = await Job.findById(req.params.jobId);

  if (!job) {
    return next(new ErrorResponse('Job not found', 404));
  }
  if (job.status !== 'published') {
    return next(new ErrorResponse('This job is not currently accepting applications', 400));
  }
  if (job.expiryDate < new Date()) {
    return next(new ErrorResponse('This job posting has expired', 400));
  }
  if (!req.file) {
    return next(new ErrorResponse('Please upload a resume to apply', 400));
  }

  const existing = await Application.findOne({ job: job._id, applicant: req.user.id });
  if (existing) {
    return next(new ErrorResponse('You have already applied to this job', 400));
  }

  const application = await Application.create({
    job: job._id,
    applicant: req.user.id,
    employer: job.postedBy,
    company: job.company,
    resumeUrl: `/uploads/resumes/${req.file.filename}`,
    coverLetter: req.body.coverLetter,
    statusHistory: [{ status: 'applied', changedBy: req.user.id }],
  });

  // Counter increment done separately from the create() above so a
  // failure here doesn't roll back the application itself - the count
  // is a display convenience, not a source of truth (that's a count()
  // query against Application if it ever drifts).
  await Job.updateOne({ _id: job._id }, { $inc: { applicationsCount: 1 } });

  res.status(201).json({ success: true, data: application });
});

// @route   GET /api/v1/applications/me
// @access  Private (user)
// Powers "Applied Jobs" in the user dashboard.
exports.getMyApplications = asyncHandler(async (req, res, next) => {
  const filters = { ...req.query };
  const baseQuery = Application.find({ applicant: req.user.id });

  const builder = new QueryBuilder(baseQuery, filters);
  builder.filter().sort().paginate();

  const applications = await builder.query.populate({
    path: 'job',
    select: 'title location jobType status',
    populate: { path: 'company', select: 'name logo slug' },
  });

  const total = await Application.countDocuments({ applicant: req.user.id });

  res.status(200).json({
    success: true,
    count: applications.length,
    total,
    page: builder.pagination.page,
    pages: Math.ceil(total / builder.pagination.limit),
    data: applications,
  });
});

// @route   PUT /api/v1/applications/:id/withdraw
// @access  Private (owning applicant)
exports.withdrawApplication = asyncHandler(async (req, res, next) => {
  const application = await Application.findById(req.params.id);

  if (!application) {
    return next(new ErrorResponse('Application not found', 404));
  }
  if (application.applicant.toString() !== req.user.id) {
    return next(new ErrorResponse('You are not authorized to withdraw this application', 403));
  }
  if (['selected', 'rejected', 'withdrawn'].includes(application.status)) {
    return next(new ErrorResponse(`Cannot withdraw an application with status '${application.status}'`, 400));
  }

  application.status = 'withdrawn';
  application.statusHistory.push({ status: 'withdrawn', changedBy: req.user.id });
  await application.save();

  res.status(200).json({ success: true, data: application });
});

// @route   GET /api/v1/applications/job/:jobId
// @access  Private (owning employer, admin)
// Powers the "Applicants" screen for a specific job posting.
exports.getJobApplicants = asyncHandler(async (req, res, next) => {
  const job = await Job.findById(req.params.jobId);
  if (!job) {
    return next(new ErrorResponse('Job not found', 404));
  }
  if (job.postedBy.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('You are not authorized to view applicants for this job', 403));
  }

  const filters = { ...req.query };
  const baseQuery = Application.find({ job: job._id });

  const builder = new QueryBuilder(baseQuery, filters);
  builder.filter().sort().paginate();

  const applications = await builder.query.populate('applicant', 'name email phone avatar');
  const total = await Application.countDocuments({ job: job._id });

  res.status(200).json({
    success: true,
    count: applications.length,
    total,
    page: builder.pagination.page,
    pages: Math.ceil(total / builder.pagination.limit),
    data: applications,
  });
});

// @route   GET /api/v1/applications/employer/all
// @access  Private (employer, admin)
// Powers a company-wide applicant view across all of an employer's jobs,
// not just one job at a time.
exports.getAllEmployerApplications = asyncHandler(async (req, res, next) => {
  const filters = { ...req.query };
  const baseQuery = Application.find({ employer: req.user.id });

  const builder = new QueryBuilder(baseQuery, filters);
  builder.filter().sort().paginate();

  const applications = await builder.query
    .populate('applicant', 'name email phone avatar')
    .populate('job', 'title');

  const total = await Application.countDocuments({ employer: req.user.id });

  res.status(200).json({
    success: true,
    count: applications.length,
    total,
    page: builder.pagination.page,
    pages: Math.ceil(total / builder.pagination.limit),
    data: applications,
  });
});

// @route   PUT /api/v1/applications/:id/status
// @access  Private (owning employer, admin)
exports.updateApplicationStatus = asyncHandler(async (req, res, next) => {
  const { status, note, interviewDate } = req.body;
  const validStatuses = ['under_review', 'shortlisted', 'interview', 'selected', 'rejected'];

  if (!validStatuses.includes(status)) {
    return next(new ErrorResponse(`Status must be one of: ${validStatuses.join(', ')}`, 400));
  }

  const application = await Application.findById(req.params.id);
  if (!application) {
    return next(new ErrorResponse('Application not found', 404));
  }
  if (application.employer.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('You are not authorized to update this application', 403));
  }
  if (application.status === 'withdrawn') {
    return next(new ErrorResponse('Cannot update a withdrawn application', 400));
  }

  application.status = status;
  application.statusHistory.push({ status, changedBy: req.user.id, note });
  if (status === 'interview' && interviewDate) {
    application.interviewDate = interviewDate;
  }
  await application.save();

  // NOTE: an in-app + email notification to the applicant on status
  // change belongs here once the Notifications module is built - flagged
  // rather than silently skipped.

  res.status(200).json({ success: true, data: application });
});

// @route   GET /api/v1/applications/:id
// @access  Private (owning applicant, owning employer, admin)
exports.getApplication = asyncHandler(async (req, res, next) => {
  const application = await Application.findById(req.params.id)
    .populate('applicant', 'name email phone avatar')
    .populate({ path: 'job', populate: { path: 'company', select: 'name logo slug' } });

  if (!application) {
    return next(new ErrorResponse('Application not found', 404));
  }

  const isOwner = application.applicant._id.toString() === req.user.id;
  const isEmployer = application.employer.toString() === req.user.id;
  if (!isOwner && !isEmployer && req.user.role !== 'admin') {
    return next(new ErrorResponse('You are not authorized to view this application', 403));
  }

  res.status(200).json({ success: true, data: application });
});
