const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const Resume = require('../models/Resume');
const { generateResumePdf } = require('../services/pdfGenerator');

// Fields that can never be set directly through a client payload -
// ownership and identity fields must only ever be set by server logic.
const stripProtectedFields = (body) => {
  const clone = { ...body };
  delete clone.user;
  delete clone.shareToken;
  delete clone._id;
  delete clone.createdAt;
  delete clone.updatedAt;
  return clone;
};

// @route   POST /api/v1/resumes
// @access  Private (user)
exports.createResume = asyncHandler(async (req, res, next) => {
  const data = stripProtectedFields(req.body);
  data.user = req.user.id;

  // First resume a user creates automatically becomes their default,
  // so there's always exactly one default once at least one exists.
  const existingCount = await Resume.countDocuments({ user: req.user.id });
  if (existingCount === 0) {
    data.isDefault = true;
  }

  const resume = await Resume.create(data);
  res.status(201).json({ success: true, data: resume });
});

// @route   GET /api/v1/resumes
// @access  Private (user)
// Powers "Resume Management" list. Excludes archived by default unless
// explicitly requested, since archived resumes shouldn't clutter the
// main list the user sees day to day.
exports.getMyResumes = asyncHandler(async (req, res, next) => {
  const filter = { user: req.user.id };
  if (req.query.status) {
    filter.status = req.query.status;
  } else {
    filter.status = { $ne: 'archived' };
  }

  const resumes = await Resume.find(filter).sort('-updatedAt');
  res.status(200).json({ success: true, count: resumes.length, data: resumes });
});

// @route   GET /api/v1/resumes/:id
// @access  Private (owner)
exports.getResume = asyncHandler(async (req, res, next) => {
  const resume = await Resume.findById(req.params.id);

  if (!resume) {
    return next(new ErrorResponse('Resume not found', 404));
  }
  if (resume.user.toString() !== req.user.id) {
    return next(new ErrorResponse('You are not authorized to view this resume', 403));
  }

  res.status(200).json({ success: true, data: resume });
});

// @route   PUT /api/v1/resumes/:id
// @access  Private (owner)
// Used for both manual edits and auto-save - the frontend can call this
// on every field change; lastAutoSavedAt is updated so the UI can show
// "Saved 2 seconds ago" without a separate endpoint.
exports.updateResume = asyncHandler(async (req, res, next) => {
  let resume = await Resume.findById(req.params.id);

  if (!resume) {
    return next(new ErrorResponse('Resume not found', 404));
  }
  if (resume.user.toString() !== req.user.id) {
    return next(new ErrorResponse('You are not authorized to update this resume', 403));
  }

  const data = stripProtectedFields(req.body);
  data.lastAutoSavedAt = new Date();

  resume = await Resume.findByIdAndUpdate(req.params.id, data, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({ success: true, data: resume });
});

// @route   DELETE /api/v1/resumes/:id
// @access  Private (owner)
exports.deleteResume = asyncHandler(async (req, res, next) => {
  const resume = await Resume.findById(req.params.id);

  if (!resume) {
    return next(new ErrorResponse('Resume not found', 404));
  }
  if (resume.user.toString() !== req.user.id) {
    return next(new ErrorResponse('You are not authorized to delete this resume', 403));
  }

  const wasDefault = resume.isDefault;
  await resume.deleteOne();

  // If the deleted resume was the default, promote the most recently
  // updated remaining resume so the user still has exactly one default
  // (or zero, if they deleted their last resume) rather than none set.
  if (wasDefault) {
    const nextResume = await Resume.findOne({ user: req.user.id }).sort('-updatedAt');
    if (nextResume) {
      nextResume.isDefault = true;
      await nextResume.save();
    }
  }

  res.status(200).json({ success: true, data: {} });
});

// @route   POST /api/v1/resumes/:id/duplicate
// @access  Private (owner)
exports.duplicateResume = asyncHandler(async (req, res, next) => {
  const original = await Resume.findById(req.params.id);

  if (!original) {
    return next(new ErrorResponse('Resume not found', 404));
  }
  if (original.user.toString() !== req.user.id) {
    return next(new ErrorResponse('You are not authorized to duplicate this resume', 403));
  }

  const clone = original.toObject();
  delete clone._id;
  delete clone.createdAt;
  delete clone.updatedAt;
  delete clone.shareToken;
  clone.title = `${original.title} (Copy)`;
  clone.isDefault = false; // a duplicate never inherits default status
  clone.status = 'draft';
  clone.isShareable = false;

  const duplicate = await Resume.create(clone);
  res.status(201).json({ success: true, data: duplicate });
});

// @route   PUT /api/v1/resumes/:id/rename
// @access  Private (owner)
exports.renameResume = asyncHandler(async (req, res, next) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return next(new ErrorResponse('Please provide a new title', 400));
  }

  const resume = await Resume.findById(req.params.id);
  if (!resume) {
    return next(new ErrorResponse('Resume not found', 404));
  }
  if (resume.user.toString() !== req.user.id) {
    return next(new ErrorResponse('You are not authorized to rename this resume', 403));
  }

  resume.title = title.trim();
  await resume.save();

  res.status(200).json({ success: true, data: resume });
});

// @route   PUT /api/v1/resumes/:id/status
// @access  Private (owner)
// Handles publish / archive / restore-to-draft as one status transition
// endpoint rather than three separate routes.
exports.updateResumeStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;
  const validStatuses = ['draft', 'published', 'archived'];

  if (!validStatuses.includes(status)) {
    return next(new ErrorResponse(`Status must be one of: ${validStatuses.join(', ')}`, 400));
  }

  const resume = await Resume.findById(req.params.id);
  if (!resume) {
    return next(new ErrorResponse('Resume not found', 404));
  }
  if (resume.user.toString() !== req.user.id) {
    return next(new ErrorResponse('You are not authorized to update this resume', 403));
  }

  resume.status = status;
  // Archiving a default resume clears its default flag - an archived
  // resume should never be the one auto-selected when applying to a job.
  if (status === 'archived' && resume.isDefault) {
    resume.isDefault = false;
  }
  await resume.save();

  res.status(200).json({ success: true, data: resume });
});

// @route   PUT /api/v1/resumes/:id/set-default
// @access  Private (owner)
exports.setDefaultResume = asyncHandler(async (req, res, next) => {
  const resume = await Resume.findById(req.params.id);
  if (!resume) {
    return next(new ErrorResponse('Resume not found', 404));
  }
  if (resume.user.toString() !== req.user.id) {
    return next(new ErrorResponse('You are not authorized to update this resume', 403));
  }
  if (resume.status === 'archived') {
    return next(new ErrorResponse('An archived resume cannot be set as default. Restore it first.', 400));
  }

  // Unset default on every other resume this user owns before setting
  // the new one, so exactly one resume is ever marked default.
  await Resume.updateMany({ user: req.user.id, _id: { $ne: resume._id } }, { isDefault: false });
  resume.isDefault = true;
  await resume.save();

  res.status(200).json({ success: true, data: resume });
});

// @route   PUT /api/v1/resumes/:id/share
// @access  Private (owner)
// Toggles public sharing on/off and returns the shareable URL.
exports.toggleShare = asyncHandler(async (req, res, next) => {
  const resume = await Resume.findById(req.params.id);
  if (!resume) {
    return next(new ErrorResponse('Resume not found', 404));
  }
  if (resume.user.toString() !== req.user.id) {
    return next(new ErrorResponse('You are not authorized to update this resume', 403));
  }

  const { enable } = req.body;

  if (enable === false) {
    resume.isShareable = false;
    await resume.save();
    return res.status(200).json({ success: true, data: { isShareable: false } });
  }

  if (!resume.shareToken) {
    resume.generateShareToken();
  } else {
    resume.isShareable = true;
  }
  await resume.save();

  const shareUrl = `${process.env.CLIENT_URL}/resume/shared/${resume.shareToken}`;
  res.status(200).json({ success: true, data: { isShareable: true, shareUrl, shareToken: resume.shareToken } });
});

// @route   GET /api/v1/resumes/shared/:token
// @access  Public
exports.getSharedResume = asyncHandler(async (req, res, next) => {
  const resume = await Resume.findOne({ shareToken: req.params.token, isShareable: true });

  if (!resume) {
    return next(new ErrorResponse('This shared resume link is invalid or has been disabled', 404));
  }

  res.status(200).json({ success: true, data: resume });
});

// @route   GET /api/v1/resumes/:id/download
// @access  Private (owner)
exports.downloadResumePdf = asyncHandler(async (req, res, next) => {
  const resume = await Resume.findById(req.params.id);

  if (!resume) {
    return next(new ErrorResponse('Resume not found', 404));
  }
  if (resume.user.toString() !== req.user.id) {
    return next(new ErrorResponse('You are not authorized to download this resume', 403));
  }

  const pdfBuffer = await generateResumePdf(resume);

  const safeFileName = (resume.title || 'resume').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${safeFileName}.pdf"`,
    'Content-Length': pdfBuffer.length,
  });
  res.send(pdfBuffer);
});

// @route   GET /api/v1/resumes/shared/:token/download
// @access  Public
// Lets anyone with a valid share link download the PDF too, not just
// view the JSON - matches the spec's "Share" + "Download PDF" as
// independent capabilities.
exports.downloadSharedResumePdf = asyncHandler(async (req, res, next) => {
  const resume = await Resume.findOne({ shareToken: req.params.token, isShareable: true });

  if (!resume) {
    return next(new ErrorResponse('This shared resume link is invalid or has been disabled', 404));
  }

  const pdfBuffer = await generateResumePdf(resume);
  const safeFileName = (resume.title || 'resume').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${safeFileName}.pdf"`,
    'Content-Length': pdfBuffer.length,
  });
  res.send(pdfBuffer);
});
