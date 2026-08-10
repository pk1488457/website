const express = require('express');
const router = express.Router();

const {
  applyToJob,
  getMyApplications,
  withdrawApplication,
  getJobApplicants,
  getAllEmployerApplications,
  updateApplicationStatus,
  getApplication,
} = require('../controllers/applicationController');

const { protect, authorize } = require('../middleware/auth');
const { uploadResume, handleUpload } = require('../utils/fileUpload');

// Order matters: literal paths before '/:id'.
router.get('/me', protect, getMyApplications);
router.get('/employer/all', protect, authorize('employer', 'admin'), getAllEmployerApplications);
router.get('/job/:jobId', protect, authorize('employer', 'admin'), getJobApplicants);

router.post('/:jobId', protect, authorize('user'), handleUpload(uploadResume.single('resume')), applyToJob);
router.put('/:id/withdraw', protect, authorize('user'), withdrawApplication);
router.put('/:id/status', protect, authorize('employer', 'admin'), updateApplicationStatus);
router.get('/:id', protect, getApplication);

module.exports = router;
