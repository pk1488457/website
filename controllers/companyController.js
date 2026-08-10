const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const Company = require('../models/Company');

// @route   GET /api/v1/companies
// @access  Public
exports.getCompanies = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 12, 50);
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.keyword) {
    filter.name = new RegExp(req.query.keyword, 'i');
  }
  if (req.query.industry) {
    filter.industry = req.query.industry;
  }

  const companies = await Company.find(filter).skip(skip).limit(limit).sort('-createdAt');
  const total = await Company.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: companies.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: companies,
  });
});

// @route   GET /api/v1/companies/:slug
// @access  Public
exports.getCompany = asyncHandler(async (req, res, next) => {
  const company = await Company.findOne({ slug: req.params.slug });

  if (!company) {
    return next(new ErrorResponse('Company not found', 404));
  }

  const Job = require('../models/Job');
  const openJobs = await Job.find({ company: company._id, status: 'published' })
    .select('title location jobType salaryMin salaryMax isSalaryDisclosed createdAt')
    .sort('-createdAt');

  res.status(200).json({ success: true, data: company, openJobs });
});

// @route   POST /api/v1/companies
// @access  Private (employer)
exports.createCompany = asyncHandler(async (req, res, next) => {
  // One employer account owns exactly one company profile in this schema.
  const existing = await Company.findOne({ owner: req.user.id });
  if (existing) {
    return next(
      new ErrorResponse('You already have a company profile. Use update instead.', 400)
    );
  }

  req.body.owner = req.user.id;
  const company = await Company.create(req.body);

  res.status(201).json({ success: true, data: company });
});

// @route   PUT /api/v1/companies/:id
// @access  Private (owning employer, admin)
exports.updateCompany = asyncHandler(async (req, res, next) => {
  let company = await Company.findById(req.params.id);

  if (!company) {
    return next(new ErrorResponse('Company not found', 404));
  }

  if (company.owner.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('You are not authorized to update this company', 403));
  }

  delete req.body.owner;
  delete req.body.isVerified; // only admin can verify - handled in admin controller

  company = await Company.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({ success: true, data: company });
});

// @route   GET /api/v1/companies/employer/mine
// @access  Private (employer)
exports.getMyCompany = asyncHandler(async (req, res, next) => {
  const company = await Company.findOne({ owner: req.user.id });

  if (!company) {
    return res.status(200).json({ success: true, data: null });
  }

  res.status(200).json({ success: true, data: company });
});
