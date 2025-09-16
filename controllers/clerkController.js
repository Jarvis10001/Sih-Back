const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Clerk = require('../models/Clerk');
const Admission = require('../models/Admission');

// @desc    Clerk login
// @route   POST /api/clerk/login
// @access  Public
const loginClerk = async (req, res) => {
  try {
    const { employeeId, password } = req.body;

    // Validation
    if (!employeeId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide employee ID and password'
      });
    }

    // Check if clerk exists and is active
    const clerk = await Clerk.findOne({ 
      employeeId,
      isActive: true 
    }).select('+password');

    if (!clerk) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials or account inactive'
      });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, clerk.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Create JWT payload
    const payload = {
      user: {
        id: clerk._id,
        role: 'clerk',
        employeeId: clerk.employeeId,
        systemAccess: clerk.systemAccess
      }
    };

    // Generate JWT token
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '24h'
    });

    // Prepare response data (exclude sensitive information)
    const clerkData = {
      id: clerk._id,
      employeeId: clerk.employeeId,
      personalInfo: clerk.personalInfo,
      professionalInfo: clerk.professionalInfo,
      systemAccess: clerk.systemAccess,
      lastLogin: new Date()
    };

    // Update last login
    clerk.lastLogin = new Date();
    await clerk.save();

    res.json({
      success: true,
      message: 'Login successful',
      token,
      clerk: clerkData
    });

  } catch (error) {
    console.error('Clerk login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

// @desc    Get clerk profile
// @route   GET /api/clerk/profile
// @access  Private (Clerk only)
const getClerkProfile = async (req, res) => {
  try {
    // Check if user is clerk
    if (req.user.role !== 'clerk') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Clerk role required.'
      });
    }

    const clerk = await Clerk.findById(req.user.id).select('-password');
    
    if (!clerk) {
      return res.status(404).json({
        success: false,
        message: 'Clerk not found'
      });
    }

    res.json({
      success: true,
      clerk
    });

  } catch (error) {
    console.error('Get clerk profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching profile'
    });
  }
};

// @desc    Update clerk profile
// @route   PUT /api/clerk/profile
// @access  Private (Clerk only)
const updateClerkProfile = async (req, res) => {
  try {
    // Check if user is clerk
    if (req.user.role !== 'clerk') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Clerk role required.'
      });
    }

    const {
      personalInfo,
      professionalInfo
    } = req.body;

    const clerk = await Clerk.findById(req.user.id);
    
    if (!clerk) {
      return res.status(404).json({
        success: false,
        message: 'Clerk not found'
      });
    }

    // Update allowed fields only
    if (personalInfo) {
      clerk.personalInfo = {
        ...clerk.personalInfo,
        phone: personalInfo.phone || clerk.personalInfo.phone,
        address: personalInfo.address || clerk.personalInfo.address,
        emergencyContact: personalInfo.emergencyContact || clerk.personalInfo.emergencyContact
      };
    }

    if (professionalInfo) {
      clerk.professionalInfo = {
        ...clerk.professionalInfo,
        experience: professionalInfo.experience || clerk.professionalInfo.experience
      };
    }

    clerk.updatedAt = new Date();
    await clerk.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      clerk: clerk.toObject({ transform: (doc, ret) => { delete ret.password; return ret; } })
    });

  } catch (error) {
    console.error('Update clerk profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating profile'
    });
  }
};

// @desc    Get clerk dashboard statistics
// @route   GET /api/clerk/dashboard-stats
// @access  Private (Clerk only)
const getDashboardStats = async (req, res) => {
  try {
    // Check if user is clerk
    if (req.user.role !== 'clerk') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Clerk role required.'
      });
    }

    const clerk = await Clerk.findById(req.user.id);
    
    if (!clerk) {
      return res.status(404).json({
        success: false,
        message: 'Clerk not found'
      });
    }

    // Basic stats that all clerks can see
    const stats = {
      modules: clerk.systemAccess.modules.length,
      accessLevel: clerk.systemAccess.accessLevel,
      department: clerk.professionalInfo.department,
      workShift: clerk.professionalInfo.workShift,
      lastLogin: clerk.lastLogin || 'Never'
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Get clerk dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard stats'
    });
  }
};

// @desc    Change clerk password
// @route   POST /api/clerk/change-password
// @access  Private (Clerk only)
const changePassword = async (req, res) => {
  try {
    // Check if user is clerk
    if (req.user.role !== 'clerk') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Clerk role required.'
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    const clerk = await Clerk.findById(req.user.id).select('+password');
    
    if (!clerk) {
      return res.status(404).json({
        success: false,
        message: 'Clerk not found'
      });
    }

    // Validate current password
    const isMatch = await bcrypt.compare(currentPassword, clerk.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    clerk.password = await bcrypt.hash(newPassword, salt);
    clerk.updatedAt = new Date();

    await clerk.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change clerk password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while changing password'
    });
  }
};

// @desc    Get admission applications for verification
// @route   GET /api/clerk/admission-applications
// @access  Private (Clerk only)
const getAdmissionApplications = async (req, res) => {
  try {
    // Check if user is clerk
    if (req.user.role !== 'clerk') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Clerk role required.'
      });
    }

    // Check if clerk has admission processing access
    const clerk = await Clerk.findById(req.user.id);
    if (!clerk.systemAccess.modules.includes('admission_processing')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admission processing permission required.'
      });
    }

    const { status = 'pending' } = req.query;
    
    let query = {};
    if (status === 'pending') {
      query.verificationStatus = { $in: ['pending', null, undefined] };
    } else {
      query.verificationStatus = status;
    }

    const applications = await Admission.find(query)
      .sort({ createdAt: -1 })
      .select('-__v');

    res.json({
      success: true,
      applications
    });

  } catch (error) {
    console.error('Get admission applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching applications'
    });
  }
};

// @desc    Verify student application and assign student ID
// @route   PUT /api/clerk/verify-student/:id
// @access  Private (Clerk only)
const verifyStudentApplication = async (req, res) => {
  try {
    // Check if user is clerk
    if (req.user.role !== 'clerk') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Clerk role required.'
      });
    }

    // Check if clerk has admission processing access
    const clerk = await Clerk.findById(req.user.id);
    if (!clerk.systemAccess.modules.includes('admission_processing')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admission processing permission required.'
      });
    }

    const { status, verificationNotes, studentId } = req.body;
    const applicationId = req.params.id;

    // Validation
    if (!status || !['verified', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status (verified/rejected) is required'
      });
    }

    if (status === 'verified' && !studentId) {
      return res.status(400).json({
        success: false,
        message: 'Student ID is required for verification'
      });
    }

    const application = await Admission.findById(applicationId);
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Check if student ID already exists (if verifying)
    if (status === 'verified') {
      const existingStudent = await Admission.findOne({ 
        studentId: studentId,
        _id: { $ne: applicationId }
      });
      
      if (existingStudent) {
        return res.status(400).json({
          success: false,
          message: 'Student ID already exists. Please generate a unique ID.'
        });
      }
    }

    // Update application
    application.verificationStatus = status;
    application.verificationNotes = verificationNotes;
    application.verifiedBy = req.user.id;
    application.verifiedAt = new Date();
    
    if (status === 'verified') {
      application.studentId = studentId;
      application.admissionStatus = 'admitted';
    } else {
      application.admissionStatus = 'rejected';
    }

    await application.save();

    res.json({
      success: true,
      message: `Application ${status} successfully`,
      application
    });

  } catch (error) {
    console.error('Verify student application error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while verifying application'
    });
  }
};

// @desc    Get verification statistics for clerk dashboard
// @route   GET /api/clerk/verification-stats
// @access  Private (Clerk only)
const getVerificationStats = async (req, res) => {
  try {
    // Check if user is clerk
    if (req.user.role !== 'clerk') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Clerk role required.'
      });
    }

    // Check if clerk has admission processing access
    const clerk = await Clerk.findById(req.user.id);
    if (!clerk.systemAccess.modules.includes('admission_processing')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admission processing permission required.'
      });
    }

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // Get overall stats
    const totalApplications = await Admission.countDocuments();
    const pendingApplications = await Admission.countDocuments({
      verificationStatus: { $in: ['pending', null, undefined] }
    });
    const verifiedApplications = await Admission.countDocuments({
      verificationStatus: 'verified'
    });
    const rejectedApplications = await Admission.countDocuments({
      verificationStatus: 'rejected'
    });

    // Get today's verifications by this clerk
    const todayVerifications = await Admission.countDocuments({
      verifiedBy: req.user.id,
      verifiedAt: { $gte: startOfDay, $lte: endOfDay }
    });

    const stats = {
      totalApplications,
      pendingApplications,
      verifiedApplications,
      rejectedApplications,
      todayVerifications,
      verificationRate: totalApplications > 0 ? 
        Math.round(((verifiedApplications + rejectedApplications) / totalApplications) * 100) : 0
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Get verification stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching verification stats'
    });
  }
};

module.exports = {
  loginClerk,
  getClerkProfile,
  updateClerkProfile,
  getDashboardStats,
  changePassword,
  getAdmissionApplications,
  verifyStudentApplication,
  getVerificationStats
};