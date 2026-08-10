const express = require('express');
const router = express.Router();

const {
  getCompanies,
  getCompany,
  createCompany,
  updateCompany,
  getMyCompany,
} = require('../controllers/companyController');

const { protect, authorize } = require('../middleware/auth');
const { validate, createCompanyRules } = require('../middleware/validators');

// Registered before '/:slug' for the same reason as jobs/employer/mine -
// avoids "mine" being interpreted as a slug lookup.
router.get('/employer/mine', protect, authorize('employer', 'admin'), getMyCompany);

router.get('/', getCompanies);
router.get('/:slug', getCompany);

router.post('/', protect, authorize('employer', 'admin'), createCompanyRules, validate, createCompany);
router.put('/:id', protect, authorize('employer', 'admin'), updateCompany);

module.exports = router;
