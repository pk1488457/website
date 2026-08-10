const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a job title'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    description: {
      type: String,
      required: [true, 'Please add a job description'],
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    responsibilities: [String],
    requirements: [String],
    // Free-text skill tags rather than a foreign-key skills collection -
    // simpler for search/filter at this scale and avoids forcing employers
    // to only pick from a fixed, pre-seeded skill list.
    skills: [{ type: String, trim: true, lowercase: true }],
    benefits: [String],
    location: {
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      country: { type: String, default: 'India' },
    },
    isRemote: {
      type: Boolean,
      default: false,
    },
    jobType: {
      type: String,
      enum: ['full-time', 'part-time', 'contract', 'internship', 'freelance'],
      required: true,
    },
    experienceMin: {
      type: Number,
      default: 0,
      min: 0,
    },
    experienceMax: {
      type: Number,
      min: 0,
    },
    salaryMin: Number,
    salaryMax: Number,
    salaryCurrency: {
      type: String,
      default: 'INR',
    },
    // Employers frequently prefer not to disclose salary; storing this
    // separately lets the UI show "Not disclosed" instead of a fake range.
    isSalaryDisclosed: {
      type: Boolean,
      default: true,
    },
    industry: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'closed', 'expired'],
      default: 'draft',
    },
    applicationsCount: {
      type: Number,
      default: 0,
    },
    viewsCount: {
      type: Number,
      default: 0,
    },
    expiryDate: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
    savedByCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Text index powers keyword search across title/description/skills in a
// single query instead of chained regex matches, which don't scale.
JobSchema.index({ title: 'text', description: 'text', skills: 'text' });

// Compound indexes matching the most common filter combinations used in
// getJobs (status + location, status + jobType) so those queries hit an
// index instead of a full collection scan as job volume grows.
JobSchema.index({ status: 1, 'location.city': 1 });
JobSchema.index({ status: 1, jobType: 1 });
JobSchema.index({ status: 1, createdAt: -1 });
JobSchema.index({ company: 1 });
JobSchema.index({ postedBy: 1 });

// Auto-expire jobs whose expiryDate has passed. Run lazily on read rather
// than a cron job for simplicity - a scheduled job (Module: services/cron)
// can be added later to proactively flip status without waiting for a read.
JobSchema.statics.markExpiredIfNeeded = async function (job) {
  if (job.status === 'published' && job.expiryDate < new Date()) {
    job.status = 'expired';
    await job.save();
  }
  return job;
};

module.exports = mongoose.model('Job', JobSchema);
