const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
      trim: true,
      maxlength: [50, 'Name cannot be more than 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email',
      ],
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never return password in queries by default
    },
    // Role determines dashboard access: job seeker, employer, or platform admin.
    // Kept as a single field rather than separate collections per role because
    // it lets one account model back auth for all three dashboards uniformly.
    role: {
      type: String,
      enum: ['user', 'employer', 'admin'],
      default: 'user',
    },
    phone: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
      default: 'default-avatar.png',
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    emailVerificationExpire: Date,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    // Tracks failed login attempts to support account lockout, a basic
    // brute-force defense beyond just rate limiting the route.
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: Date,
    refreshToken: String,
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: Date,
  },
  { timestamps: true }
);

// Hash password before saving, but only when it's new or changed -
// otherwise every profile update would re-hash an already-hashed password.
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare entered password with the hashed one stored in DB.
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Short-lived access token used on every authenticated request.
UserSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// Long-lived refresh token, stored hashed on the user document, used only
// to mint new access tokens without forcing re-login every 7 days.
UserSchema.methods.getRefreshToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE,
  });
};

// Generates a random token for password reset, stores only its SHA-256
// hash in the DB (so a DB leak doesn't expose usable reset tokens), and
// returns the plain token to be emailed to the user.
UserSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString('hex');

  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

// Account lockout: after 5 failed attempts, lock for 15 minutes.
UserSchema.methods.incLoginAttempts = async function () {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    this.loginAttempts = 1;
    this.lockUntil = undefined;
  } else {
    this.loginAttempts += 1;
    if (this.loginAttempts >= 5 && !this.isLocked()) {
      this.lockUntil = Date.now() + 15 * 60 * 1000;
    }
  }
  await this.save();
};

UserSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

UserSchema.methods.resetLoginAttempts = async function () {
  this.loginAttempts = 0;
  this.lockUntil = undefined;
  this.lastLogin = Date.now();
  await this.save();
};

module.exports = mongoose.model('User', UserSchema);
