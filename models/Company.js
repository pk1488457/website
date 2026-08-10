const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a company name'],
      trim: true,
      maxlength: [100, 'Company name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true,
    },
    logo: {
      type: String,
      default: 'default-company-logo.png',
    },
    description: {
      type: String,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    website: {
      type: String,
      match: [
        /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/,
        'Please enter a valid URL',
      ],
    },
    industry: {
      type: String,
      trim: true,
    },
    // Bucketed rather than exact headcount - matches how job boards
    // typically let candidates filter ("50-200 employees") and avoids
    // employers having to keep an exact number updated.
    companySize: {
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'],
    },
    foundedYear: Number,
    location: {
      city: String,
      state: String,
      country: { type: String, default: 'India' },
    },
    socialLinks: {
      linkedin: String,
      twitter: String,
      facebook: String,
    },
    // Owning employer account. One employer account maps to one company
    // in this schema; a multi-recruiter-per-company model would need a
    // separate join table, which is out of scope for this build.
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Auto-generate a URL-safe slug from the company name, and disambiguate
// it if another company already has the same slug, so /companies/:slug
// routes work without manual slug entry.
CompanySchema.pre('save', async function (next) {
  if (!this.isModified('name') && this.slug) {
    return next();
  }
  let baseSlug = this.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  let slug = baseSlug;
  let counter = 1;
  const Company = this.constructor;
  while (await Company.findOne({ slug, _id: { $ne: this._id } })) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
  this.slug = slug;
  next();
});

module.exports = mongoose.model('Company', CompanySchema);
