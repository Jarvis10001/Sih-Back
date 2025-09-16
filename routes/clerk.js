const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  loginClerk,
  getClerkProfile,
  updateClerkProfile,
  getDashboardStats,
  changePassword,
  getAdmissionApplications,
  verifyStudentApplication,
  getVerificationStats
} = require('../controllers/clerkController');

const router = express.Router();

// @route   POST /api/clerk/login
// @desc    Clerk login
// @access  Public
router.post('/login', loginClerk);

// @route   GET /api/clerk/profile
// @desc    Get clerk profile
// @access  Private (Clerk only)
router.get('/profile', authenticate, getClerkProfile);

// @route   PUT /api/clerk/profile
// @desc    Update clerk profile
// @access  Private (Clerk only)
router.put('/profile', authenticate, updateClerkProfile);

// @route   GET /api/clerk/dashboard-stats
// @desc    Get clerk dashboard statistics
// @access  Private (Clerk only)
router.get('/dashboard-stats', authenticate, getDashboardStats);

// @route   POST /api/clerk/change-password
// @desc    Change clerk password
// @access  Private (Clerk only)
router.post('/change-password', authenticate, changePassword);

// @route   GET /api/clerk/admission-applications
// @desc    Get admission applications for verification
// @access  Private (Clerk only)
router.get('/admission-applications', authenticate, getAdmissionApplications);

// @route   PUT /api/clerk/verify-student/:id
// @desc    Verify student application and assign student ID
// @access  Private (Clerk only)
router.put('/verify-student/:id', authenticate, verifyStudentApplication);

// @route   GET /api/clerk/verification-stats
// @desc    Get verification statistics for clerk dashboard
// @access  Private (Clerk only)
router.get('/verification-stats', authenticate, getVerificationStats);

module.exports = router;