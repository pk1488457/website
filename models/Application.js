const mongoose = require('mongoose');

const ApplicationSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Denormalized onto the application at apply-time so employer queries
    // ("all applications for my company") don't need an extra join back
    // through Job every time, and so history stays accurate even if a
    // job is later reassigned or a company is renamed.
    employer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    // Path to an uploaded resume file. Once the Resume Builder module
    // exists, resumeId (below) can be used instead so an applicant can
    // apply with a resume built in-app rather than an uploaded file.
    resumeUrl: {
      type: String,
      required: true,
    },
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resume',
    },
    coverLetter: {
      type: String,
      maxlength: [3000, 'Cover letter cannot exceed 3000 characters'],
    },
    status: {
      type: String,
      enum: ['applied', 'under_review', 'shortlisted', 'interview', 'selected', 'rejected', 'withdrawn'],
      default: 'applied',
    },
    // Full audit trail of status changes - lets both the applicant and
    // employer see exactly when a status changed, not just the current
    // state, which matters for an "Application Updates" notification feed.
    statusHistory: [
      {
        status: String,
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: String,
      },
    ],
    interviewDate: Date,
    interviewNotes: String,
    employerNotes: {
      type: String,
      maxlength: [2000, 'Notes cannot exceed 2000 characters'],
    },
  },
  { timestamps: true }
);

// A user can only apply to a given job once - enforced at the DB level
// (not just in application logic) so a race condition or a bug elsewhere
// in the code can't create duplicate applications.
ApplicationSchema.index({ job: 1, applicant: 1 }, { unique: true });
ApplicationSchema.index({ applicant: 1, createdAt: -1 });
ApplicationSchema.index({ employer: 1, status: 1 });
ApplicationSchema.index({ job: 1, status: 1 });

module.exports = mongoose.model('Application', ApplicationSchema);
