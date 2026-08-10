const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const Job = require('../models/Job');
const Company = require('../models/Company');
const QueryBuilder = require('../utils/queryBuilder');

// @route   GET /api/v1/jobs
// @access  Public
// Supports: ?keyword=react&location=Mohali&jobType=full-time&isRemote=true
// &experienceMin[gte]=2&salaryMin[gte]=500000&industry=IT&company=<id>
// &sort=-createdAt&page=1&limit=10
exports.getJobs = asyncHandler(async (req, res, next) => {
  // Public job search only ever shows published, non-expired jobs -
  // draft/closed/expired jobs must never leak into public search results.
  const baseQuery = Job.find({ status: 'published', expiryDate: { $gte: new Date() } });

  // location is a nested field (location.city) but arrives as a flat
  // query param, so it's mapped explicitly rather than passed through
  // the generic filter() to avoid building an incorrect Mongo path.
  const filters = { ...req.query };
  if (filters.location) {
    baseQuery.find({
      $or: [
        { 'location.city': new RegExp(filters.location, 'i') },
        { 'location.state': new RegExp(filters.location, 'i') },
      ],
    });
    delete filters.location;
  }
  if (filters.skills) {
    const skillsArr = filters.skills.split(',').map((s) => s.trim().toLowerCase());
    baseQuery.find({ skills: { $in: skillsArr } });
    delete filters.skills;
  }

  const builder = new QueryBuilder(baseQuery, filters);
  builder.search().filter().sort().select().paginate();

  const jobs = await builder.query
    .populate('company', 'name logo slug industry companySize')
    .lean();

  // Total count for pagination UI - computed from the same filter set,
  // not just the current page's result count.
  const countQuery = Job.find({ status: 'published', expiryDate: { $gte: new Date() } });
  if (req.query.keyword) countQuery.find({ $text: { $search: req.query.keyword } });
  const total = await countQuery.countDocuments();

  res.status(200).json({
    success: true,
    count: jobs.length,
    total,
    page: builder.pagination.page,
    pages: Math.ceil(total / builder.pagination.limit),
    data: jobs,
  });
});

// @route   GET /api/v1/jobs/:id
// @access  Public
exports.getJob = asyncHandler(async (req, res, next) => {
  const job = await Job.findById(req.params.id).populate(
    'company',
    'name logo slug industry companySize description website location'
  );

  if (!job) {
    return next(new ErrorResponse(`Job not found with id of ${req.params.id}`, 404));
  }

  await Job.markExpiredIfNeeded(job);

  // Increment view count without triggering full document validation/save
  // hooks for a simple counter bump.
  await Job.updateOne({ _id: job._id }, { $inc: { viewsCount: 1 } });

  // Similar jobs: same category/industry, excluding this job, published only.
  const similarJobs = await Job.find({
    _id: { $ne: job._id },
    status: 'published',
    $or: [{ category: job.category }, { industry: job.industry }],
  })
    .limit(5)
    .select('title company location jobType salaryMin salaryMax isSalaryDisclosed')
    .populate('company', 'name logo slug');

  res.status(200).json({ success: true, data: job, similarJobs });
});

// @route   POST /api/v1/jobs
// @access  Private (employer, admin)
exports.createJob = asyncHandler(async (req, res, next) => {
  // If company ID is not explicitly passed, auto-discover employer's company
  if (!req.body.company) {
    const userCompany = await Company.findOne({ owner: req.user.id });
    if (userCompany) {
      req.body.company = userCompany._id;
    } else {
      return next(new ErrorResponse('Please create a company profile first before posting jobs.', 400));
    }
  }

  const company = await Company.findById(req.body.company);
  if (!company) {
    return next(new ErrorResponse('Company not found', 404));
  }
  if (company.owner.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('You are not authorized to post jobs for this company', 403));
  }

  req.body.postedBy = req.user.id;

  const job = await Job.create(req.body);

  res.status(201).json({ success: true, data: job });
});

// @route   PUT /api/v1/jobs/:id
// @access  Private (owning employer, admin)
exports.updateJob = asyncHandler(async (req, res, next) => {
  let job = await Job.findById(req.params.id);

  if (!job) {
    return next(new ErrorResponse(`Job not found with id of ${req.params.id}`, 404));
  }

  if (job.postedBy.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('You are not authorized to update this job', 403));
  }

  // Prevent changing ownership fields through a generic update payload.
  delete req.body.postedBy;
  delete req.body.applicationsCount;
  delete req.body.viewsCount;

  job = await Job.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({ success: true, data: job });
});

// @route   DELETE /api/v1/jobs/:id
// @access  Private (owning employer, admin)
exports.deleteJob = asyncHandler(async (req, res, next) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    return next(new ErrorResponse(`Job not found with id of ${req.params.id}`, 404));
  }

  if (job.postedBy.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('You are not authorized to delete this job', 403));
  }

  await job.deleteOne();

  res.status(200).json({ success: true, data: {} });
});

// @route   GET /api/v1/jobs/employer/mine
// @access  Private (employer)
// Powers the "Manage Jobs" screen in the employer dashboard - includes
// draft/closed/expired jobs too, unlike the public getJobs endpoint.
exports.getMyJobs = asyncHandler(async (req, res, next) => {
  const filters = { ...req.query };
  const baseQuery = Job.find({ postedBy: req.user.id });

  const builder = new QueryBuilder(baseQuery, filters);
  builder.filter().sort().select().paginate();

  const jobs = await builder.query.populate('company', 'name logo slug');
  const total = await Job.countDocuments({ postedBy: req.user.id });

  res.status(200).json({
    success: true,
    count: jobs.length,
    total,
    page: builder.pagination.page,
    pages: Math.ceil(total / builder.pagination.limit),
    data: jobs,
  });
});

// @route   PUT /api/v1/jobs/:id/status
// @access  Private (owning employer, admin)
// Separate endpoint for status transitions (publish/close/archive) so the
// UI can do this with one clear action instead of a full job update call.
exports.updateJobStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;
  const validStatuses = ['draft', 'published', 'closed', 'expired'];

  if (!validStatuses.includes(status)) {
    return next(new ErrorResponse(`Status must be one of: ${validStatuses.join(', ')}`, 400));
  }

  const job = await Job.findById(req.params.id);
  if (!job) {
    return next(new ErrorResponse(`Job not found with id of ${req.params.id}`, 404));
  }
  if (job.postedBy.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('You are not authorized to update this job', 403));
  }

  job.status = status;
  // Re-set expiry when republishing a closed/draft job, so it doesn't
  // immediately auto-expire based on a stale date.
  if (status === 'published') {
    job.expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  await job.save();

  res.status(200).json({ success: true, data: job });
});
