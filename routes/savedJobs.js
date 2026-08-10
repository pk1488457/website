const express = require('express');
const router = express.Router();

const { saveJob, unsaveJob, getSavedJobs } = require('../controllers/savedJobController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, authorize('user'), getSavedJobs);
router.post('/:jobId', protect, authorize('user'), saveJob);
router.delete('/:jobId', protect, authorize('user'), unsaveJob);

module.exports = router;
