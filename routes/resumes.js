const express = require('express');
const router = express.Router();

const {
  createResume,
  getMyResumes,
  getResume,
  updateResume,
  deleteResume,
  duplicateResume,
  renameResume,
  updateResumeStatus,
  setDefaultResume,
  toggleShare,
  getSharedResume,
  downloadResumePdf,
  downloadSharedResumePdf,
} = require('../controllers/resumeController');

const { protect, authorize } = require('../middleware/auth');

// Public share routes - registered before the authenticated '/:id' routes
// so '/shared/:token' isn't mistaken for a resume id and doesn't require
// a login the way every other route below does.
router.get('/shared/:token', getSharedResume);
router.get('/shared/:token/download', downloadSharedResumePdf);

router.use(protect, authorize('user'));

router.get('/', getMyResumes);
router.post('/', createResume);
router.get('/:id', getResume);
router.put('/:id', updateResume);
router.delete('/:id', deleteResume);

router.post('/:id/duplicate', duplicateResume);
router.put('/:id/rename', renameResume);
router.put('/:id/status', updateResumeStatus);
router.put('/:id/set-default', setDefaultResume);
router.put('/:id/share', toggleShare);
router.get('/:id/download', downloadResumePdf);

module.exports = router;
