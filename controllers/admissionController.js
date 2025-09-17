const Admission = require('../models/Admission');

// @desc    Submit admission form
// @route   POST /api/admission/submit
// @access  Private
const submitAdmission = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check if user has already submitted admission form
    const existingAdmission = await Admission.findOne({ userId });
    if (existingAdmission) {
      return res.status(400).json({
        success: false,
        message: 'Admission form has already been submitted'
      });
    }

    // Extract form data
    const {
      // Personal Information
      name,
      fatherName,
      motherName,
      gender,
      dateOfBirth,
      nationality,
      religion,
      caste,
      category,
      phoneNumber,
      email,
      aadharNumber,
      
      // Address Information
      permanentAddress,
      currentAddress,
      pincode,
      state,
      city,
      
      // Educational Information
      tenthBoard,
      tenthYear,
      tenthPercentage,
      twelfthBoard,
      twelfthYear,
      twelfthPercentage,
      jeeRank,
      jeeScore,
      
      // Course Information
      preferredCourse,
      preferredBranch,
      
      // Additional Information
      hostelRequired,
      transportRequired,
      medicalInfo,
      emergencyContact,
      guardianOccupation,
      annualIncome
    } = req.body;

    // Validate required fields (using the field names that come from frontend)
    if (!name || !fatherName || !email || !phoneNumber || !dateOfBirth) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, fatherName, email, phoneNumber, dateOfBirth'
      });
    }

    // Process uploaded files
    const documents = {};
    if (req.files) {
      Object.keys(req.files).forEach(fieldName => {
        if (req.files[fieldName] && req.files[fieldName][0]) {
          documents[fieldName] = {
            url: req.files[fieldName][0].path,
            publicId: req.files[fieldName][0].filename,
            originalName: req.files[fieldName][0].originalname,
            size: req.files[fieldName][0].size,
            uploadedAt: new Date()
          };
        }
      });
    }

    // Create admission record with correct schema structure
    const admissionData = {
      userId,
      personalInfo: {
        name,
        fatherName,
        motherName,
        gender,
        dateOfBirth: new Date(dateOfBirth),
        mobileNo: phoneNumber,  // schema expects mobileNo, not phoneNumber
        parentsMobileNo: emergencyContact,  // using emergencyContact as parentsMobileNo
        email,
        aadharNo: aadharNumber,  // schema expects aadharNo, not aadharNumber
        nationality,
        religion
      },
      addressInfo: {
        address: permanentAddress,  // schema expects address, not permanentAddress
        city,
        state,
        pincode
      },
      academicInfo: {
        course: preferredCourse,  // schema expects course, not preferredCourse
        branch: preferredBranch,  // schema expects branch, not preferredBranch
        tenth: {
          board: tenthBoard,
          percentage: parseFloat(tenthPercentage),
          yearOfPassing: parseInt(tenthYear)
        },
        twelfth: {
          board: twelfthBoard,
          percentage: parseFloat(twelfthPercentage),
          yearOfPassing: parseInt(twelfthYear)
        },
        jee: {
          rank: jeeRank ? parseInt(jeeRank) : null,
          score: jeeScore ? parseFloat(jeeScore) : null
        }
      },
      categoryInfo: {
        category
      },
      documents,
      status: 'submitted',
      submittedAt: new Date()
    };

    const admission = new Admission(admissionData);
    await admission.save();

    res.status(201).json({
      success: true,
      message: 'Admission form submitted successfully',
      admission: {
        id: admission._id,
        applicationNumber: admission.applicationNumber,
        status: admission.status,
        submittedAt: admission.submittedAt
      }
    });

  } catch (error) {
    console.error('Submit admission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit admission form',
      error: error.message
    });
  }
};

// @desc    Get admission form
// @route   GET /api/admission/form
// @access  Private
const getAdmissionForm = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const admission = await Admission.findOne({ userId });
    
    if (!admission) {
      return res.status(404).json({
        success: false,
        message: 'Admission form not found'
      });
    }

    res.json({
      success: true,
      admission
    });

  } catch (error) {
    console.error('Get admission form error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admission form',
      error: error.message
    });
  }
};

// @desc    Update admission form
// @route   PUT /api/admission/update
// @access  Private
const updateAdmissionForm = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const admission = await Admission.findOne({ userId });
    
    if (!admission) {
      return res.status(404).json({
        success: false,
        message: 'Admission form not found'
      });
    }

    // Check if form can be updated (only if not approved/rejected)
    if (['approved', 'rejected'].includes(admission.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update admission form after it has been processed'
      });
    }

    // Update the admission data
    const updateData = { ...req.body };
    delete updateData.userId; // Prevent userId changes
    
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        admission[key] = updateData[key];
      }
    });

    admission.updatedAt = new Date();
    await admission.save();

    res.json({
      success: true,
      message: 'Admission form updated successfully',
      admission
    });

  } catch (error) {
    console.error('Update admission form error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update admission form',
      error: error.message
    });
  }
};

// @desc    Get all admissions (Admin only)
// @route   GET /api/admission/all
// @access  Private (Admin)
const getAllAdmissions = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    // Build query
    const query = {};
    if (status) {
      query.status = status;
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const admissions = await Admission.find(query)
      .populate('userId', 'name email')
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Admission.countDocuments(query);

    res.json({
      success: true,
      admissions,
      pagination: {
        current: pageNum,
        pages: Math.ceil(total / limitNum),
        total
      }
    });

  } catch (error) {
    console.error('Get all admissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admissions',
      error: error.message
    });
  }
};

// @desc    Update admission status (Admin only)
// @route   PUT /api/admission/:id/status
// @access  Private (Admin)
const updateAdmissionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    if (!['pending', 'under_review', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const admission = await Admission.findById(id);
    
    if (!admission) {
      return res.status(404).json({
        success: false,
        message: 'Admission not found'
      });
    }

    admission.status = status;
    if (remarks) {
      admission.adminRemarks = remarks;
    }
    admission.updatedAt = new Date();

    await admission.save();

    res.json({
      success: true,
      message: 'Admission status updated successfully',
      admission
    });

  } catch (error) {
    console.error('Update admission status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update admission status',
      error: error.message
    });
  }
};

module.exports = {
  submitAdmission,
  getAdmissionForm,
  updateAdmissionForm,
  getAllAdmissions,
  updateAdmissionStatus
};