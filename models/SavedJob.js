const mongoose = require('mongoose');

const SavedJobSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
  },
  { timestamps: true }
);

// Prevents saving the same job twice for the same user at the DB level.
SavedJobSchema.index({ user: 1, job: 1 }, { unique: true });

module.exports = mongoose.model('SavedJob', SavedJobSchema);
