const mongoose = require('mongoose');
const crypto = require('crypto');

const ExperienceSchema = new mongoose.Schema({
  company: { type: String, required: true, trim: true },
  designation: { type: String, required: true, trim: true },
  startDate: Date,
  endDate: Date,
  isCurrent: { type: Boolean, default: false },
  description: { type: String, maxlength: 1000 },
});

const EducationSchema = new mongoose.Schema({
  degree: { type: String, required: true, trim: true },
  college: { type: String, trim: true },
  university: { type: String, trim: true },
  startYear: Number,
  endYear: Number,
  percentage: String, // stored as string to allow "8.5 CGPA" or "75%" formats
});

const ProjectSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, maxlength: 1000 },
  technology: { type: String, trim: true },
  github: String,
  liveUrl: String,
});

const CertificateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  issuer: String,
  date: Date,
  url: String,
});

const LanguageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  proficiency: {
    type: String,
    enum: ['Basic', 'Conversational', 'Fluent', 'Native'],
    default: 'Fluent',
  },
});

const ReferenceSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  position: String,
  company: String,
  email: String,
  phone: String,
});

// Custom sections let a user add arbitrary blocks (e.g. "Achievements",
// "Publications") the fixed schema doesn't anticipate, without needing a
// migration every time someone wants a new section type.
const CustomSectionItemSchema = new mongoose.Schema({
  title: String,
  subtitle: String,
  description: String,
  date: String,
});

const CustomSectionSchema = new mongoose.Schema({
  heading: { type: String, required: true },
  items: [CustomSectionItemSchema],
});

const ResumeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      // The resume's own display name (e.g. "Flutter Developer Resume"),
      // distinct from personalDetails.fullName - lets a user keep several
      // resumes for different roles without renaming their name.
      type: String,
      required: [true, 'Please give this resume a title'],
      trim: true,
      default: 'Untitled Resume',
      maxlength: 100,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    templateId: {
      type: String,
      default: 'ats-professional',
    },
    themeColor: {
      type: String,
      default: '#2563EB',
    },
    fontFamily: {
      type: String,
      default: 'Inter',
    },
    // Controls render order on the frontend live preview and in PDF export.
    sectionOrder: {
      type: [String],
      default: [
        'summary',
        'experience',
        'education',
        'skills',
        'projects',
        'certificates',
        'languages',
        'references',
        'custom',
      ],
    },
    hiddenSections: {
      type: [String],
      default: [],
    },
    personalDetails: {
      fullName: { type: String, trim: true },
      headline: { type: String, trim: true }, // e.g. "Flutter Developer"
      email: { type: String, trim: true },
      phone: { type: String, trim: true },
      location: { type: String, trim: true },
      photo: String,
      linkedin: String,
      github: String,
      portfolio: String,
    },
    summary: {
      type: String,
      maxlength: 1000,
    },
    experience: [ExperienceSchema],
    education: [EducationSchema],
    skills: [{ type: String, trim: true }],
    projects: [ProjectSchema],
    certificates: [CertificateSchema],
    languages: [LanguageSchema],
    references: [ReferenceSchema],
    customSections: [CustomSectionSchema],
    // Enables a public, unauthenticated "share this resume" link without
    // exposing the resume's real _id or requiring login to view it.
    shareToken: {
      type: String,
      unique: true,
      sparse: true,
    },
    isShareable: {
      type: Boolean,
      default: false,
    },
    lastAutoSavedAt: Date,
  },
  { timestamps: true }
);

ResumeSchema.index({ user: 1, status: 1 });
ResumeSchema.index({ user: 1, isDefault: 1 });

// Generates a short, unguessable share token the first time a resume is
// made shareable. Kept separate from _id so revoking sharing (clearing
// shareToken) doesn't require changing the resume's permanent id.
ResumeSchema.methods.generateShareToken = function () {
  this.shareToken = crypto.randomBytes(12).toString('hex');
  this.isShareable = true;
  return this.shareToken;
};

module.exports = mongoose.model('Resume', ResumeSchema);
