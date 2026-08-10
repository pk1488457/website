const express = require('express');
const router = express.Router();

const {
  getJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
  getMyJobs,
  updateJobStatus,
} = require('../controllers/jobController');

const { protect, authorize } = require('../middleware/auth');
const { validate, createJobRules, updateJobRules } = require('../middleware/validators');

// IMPORTANT: this specific route must be registered BEFORE '/:id',
// otherwise Express/Mongoose will try to cast the literal string
// "employer" into an ObjectId for the :id param and throw a CastError.
router.get('/employer/mine', protect, authorize('employer', 'admin'), getMyJobs);

router.get('/', getJobs);
router.get('/:id', getJob);

router.post('/', protect, authorize('employer', 'admin'), createJobRules, validate, createJob);
router.put('/:id', protect, authorize('employer', 'admin'), updateJobRules, validate, updateJob);
router.put('/:id/status', protect, authorize('employer', 'admin'), updateJobStatus);
router.delete('/:id', protect, authorize('employer', 'admin'), deleteJob);

module.exports = router;
