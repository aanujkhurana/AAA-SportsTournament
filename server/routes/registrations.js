const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Registration = require('../models/Registration');
const Tournament = require('../models/Tournament');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Configure multer for payment confirmation uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/payment-confirmations';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'payment-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and PDF files are allowed for payment confirmations'));
    }
  }
});

// Individual player registration
router.post('/individual', [
  auth,
  body('tournamentId').isMongoId().withMessage('Valid tournament ID is required'),
  body('emergencyContact.name').trim().notEmpty().withMessage('Emergency contact name is required'),
  body('emergencyContact.phone').matches(/^(\+61|0)[2-478](?:[ -]?[0-9]){8}$/).withMessage('Valid Australian phone number is required'),
  body('emergencyContact.relationship').trim().notEmpty().withMessage('Emergency contact relationship is required'),
  body('shirtSize').optional().isIn(['XS', 'S', 'M', 'L', 'XL', 'XXL']).withMessage('Invalid shirt size')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { tournamentId, emergencyContact, medicalConditions, dietaryRequirements, shirtSize } = req.body;

    // Check if tournament exists and registration is open
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    // Check if registration is still open
    if (tournament.status !== 'Open') {
      return res.status(400).json({
        success: false,
        message: 'Registration is not open for this tournament'
      });
    }

    if (new Date() > tournament.registrationDeadline) {
      return res.status(400).json({
        success: false,
        message: 'Registration deadline has passed'
      });
    }

    // Check if tournament is full
    const currentRegistrations = await Registration.countDocuments({
      tournament: tournamentId,
      status: { $in: ['Pending', 'Approved'] }
    });

    if (currentRegistrations >= tournament.maxParticipants) {
      return res.status(400).json({
        success: false,
        message: 'Tournament is full'
      });
    }

    // Check if user is already registered for this tournament
    const existingRegistration = await Registration.findOne({
      tournament: tournamentId,
      captain: req.user._id
    });

    if (existingRegistration) {
      return res.status(400).json({
        success: false,
        message: 'You are already registered for this tournament'
      });
    }

    // Create individual registration
    const registration = new Registration({
      tournament: tournamentId,
      type: 'Individual',
      captain: req.user._id,
      emergencyContact,
      medicalConditions,
      dietaryRequirements,
      shirtSize
    });

    await registration.save();

    // Update tournament participant count
    await Tournament.findByIdAndUpdate(tournamentId, {
      currentParticipants: currentRegistrations + 1,
      status: currentRegistrations + 1 >= tournament.maxParticipants ? 'Full' : 'Open'
    });

    // Populate registration with user details
    await registration.populate('captain', 'firstName lastName email phone');

    res.status(201).json({
      success: true,
      message: 'Individual registration successful',
      registration: registration,
      paymentInstructions: {
        bankDetails: tournament.organizerBankDetails,
        paymentReference: registration.paymentReference,
        amount: tournament.entryFee,
        instructions: `Please transfer $${tournament.entryFee} to the account details provided and include the reference "${registration.paymentReference}" in your transfer description.`
      }
    });

  } catch (error) {
    console.error('Individual registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message
    });
  }
});

// Team registration
router.post('/team', [
  auth,
  body('tournamentId').isMongoId().withMessage('Valid tournament ID is required'),
  body('teamName').trim().isLength({ min: 2, max: 50 }).withMessage('Team name must be between 2 and 50 characters'),
  body('teamMembers').isArray({ min: 1 }).withMessage('At least one team member is required'),
  body('teamMembers.*.userId').isMongoId().withMessage('Valid user ID is required for each team member'),
  body('emergencyContact.name').trim().notEmpty().withMessage('Emergency contact name is required'),
  body('emergencyContact.phone').matches(/^(\+61|0)[2-478](?:[ -]?[0-9]){8}$/).withMessage('Valid Australian phone number is required'),
  body('emergencyContact.relationship').trim().notEmpty().withMessage('Emergency contact relationship is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { tournamentId, teamName, teamMembers, emergencyContact } = req.body;

    // Check if tournament exists and registration is open
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    // Check if registration is still open
    if (tournament.status !== 'Open') {
      return res.status(400).json({
        success: false,
        message: 'Registration is not open for this tournament'
      });
    }

    if (new Date() > tournament.registrationDeadline) {
      return res.status(400).json({
        success: false,
        message: 'Registration deadline has passed'
      });
    }

    // Check if tournament is full
    const currentRegistrations = await Registration.countDocuments({
      tournament: tournamentId,
      status: { $in: ['Pending', 'Approved'] }
    });

    if (currentRegistrations >= tournament.maxParticipants) {
      return res.status(400).json({
        success: false,
        message: 'Tournament is full'
      });
    }

    // Check if user is already registered for this tournament
    const existingRegistration = await Registration.findOne({
      tournament: tournamentId,
      captain: req.user._id
    });

    if (existingRegistration) {
      return res.status(400).json({
        success: false,
        message: 'You are already registered for this tournament'
      });
    }

    // Validate team members exist and are not already registered
    const memberIds = teamMembers.map(member => member.userId);
    const users = await User.find({ _id: { $in: memberIds } });
    
    if (users.length !== memberIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more team members not found'
      });
    }

    // Check if any team members are already registered for this tournament
    const existingMemberRegistrations = await Registration.find({
      tournament: tournamentId,
      $or: [
        { captain: { $in: memberIds } },
        { teamMembers: { $in: memberIds } }
      ]
    });

    if (existingMemberRegistrations.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'One or more team members are already registered for this tournament'
      });
    }

    // Create team registration
    const registration = new Registration({
      tournament: tournamentId,
      type: 'Team',
      captain: req.user._id,
      teamName,
      teamMembers: memberIds,
      emergencyContact
    });

    await registration.save();

    // Update tournament participant count
    await Tournament.findByIdAndUpdate(tournamentId, {
      currentParticipants: currentRegistrations + 1,
      status: currentRegistrations + 1 >= tournament.maxParticipants ? 'Full' : 'Open'
    });

    // Populate registration with user details
    await registration.populate([
      { path: 'captain', select: 'firstName lastName email phone' },
      { path: 'teamMembers', select: 'firstName lastName email phone' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Team registration successful',
      registration: registration,
      paymentInstructions: {
        bankDetails: tournament.organizerBankDetails,
        paymentReference: registration.paymentReference,
        amount: tournament.entryFee,
        instructions: `Please transfer $${tournament.entryFee} to the account details provided and include the reference "${registration.paymentReference}" in your transfer description.`
      }
    });

  } catch (error) {
    console.error('Team registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message
    });
  }
});

module.exports = router;// Upload p
ayment confirmation
router.post('/:registrationId/payment-confirmation', [
  auth,
  upload.single('paymentConfirmation')
], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Payment confirmation file is required'
      });
    }

    const registration = await Registration.findById(req.params.registrationId);
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Check if user owns this registration
    if (registration.captain.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only upload payment confirmation for your own registration'
      });
    }

    // Update registration with payment confirmation file
    registration.paymentConfirmation = req.file.path;
    await registration.save();

    res.json({
      success: true,
      message: 'Payment confirmation uploaded successfully',
      fileName: req.file.filename
    });

  } catch (error) {
    console.error('Payment confirmation upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during file upload',
      error: error.message
    });
  }
});

// Get registrations for a tournament (admin only)
router.get('/tournament/:tournamentId', adminAuth, async (req, res) => {
  try {
    const registrations = await Registration.find({ tournament: req.params.tournamentId })
      .populate('captain', 'firstName lastName email phone state')
      .populate('teamMembers', 'firstName lastName email phone state')
      .populate('tournament', 'name sport entryFee')
      .sort({ registrationDate: -1 });

    res.json({
      success: true,
      registrations
    });

  } catch (error) {
    console.error('Get tournament registrations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving registrations',
      error: error.message
    });
  }
});

// Get user's registrations
router.get('/my-registrations', auth, async (req, res) => {
  try {
    const registrations = await Registration.find({ captain: req.user._id })
      .populate('tournament', 'name sport startDate endDate venue address entryFee status')
      .populate('teamMembers', 'firstName lastName email')
      .sort({ registrationDate: -1 });

    res.json({
      success: true,
      registrations
    });

  } catch (error) {
    console.error('Get user registrations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving registrations',
      error: error.message
    });
  }
});

// Update registration status (admin only)
router.put('/:registrationId/status', [
  adminAuth,
  body('status').isIn(['Pending', 'Approved', 'Rejected']).withMessage('Invalid status'),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { status, notes } = req.body;
    const registration = await Registration.findById(req.params.registrationId);
    
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    registration.status = status;
    if (notes) registration.notes = notes;
    await registration.save();

    // Update tournament capacity if status changed to/from approved
    const tournament = await Tournament.findById(registration.tournament);
    const approvedCount = await Registration.countDocuments({
      tournament: registration.tournament,
      status: 'Approved'
    });

    await Tournament.findByIdAndUpdate(registration.tournament, {
      currentParticipants: approvedCount,
      status: approvedCount >= tournament.maxParticipants ? 'Full' : 'Open'
    });

    await registration.populate([
      { path: 'captain', select: 'firstName lastName email' },
      { path: 'tournament', select: 'name sport' }
    ]);

    res.json({
      success: true,
      message: `Registration ${status.toLowerCase()} successfully`,
      registration
    });

  } catch (error) {
    console.error('Update registration status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating registration status',
      error: error.message
    });
  }
});

// Verify payment (admin only)
router.put('/:registrationId/verify-payment', [
  adminAuth,
  body('paymentStatus').isIn(['Pending', 'Confirmed', 'Rejected']).withMessage('Invalid payment status'),
  body('verificationNotes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { paymentStatus, verificationNotes } = req.body;
    const registration = await Registration.findById(req.params.registrationId);
    
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    registration.paymentStatus = paymentStatus;
    if (verificationNotes) registration.notes = verificationNotes;
    await registration.save();

    await registration.populate([
      { path: 'captain', select: 'firstName lastName email' },
      { path: 'tournament', select: 'name sport' }
    ]);

    res.json({
      success: true,
      message: `Payment ${paymentStatus.toLowerCase()} successfully`,
      registration
    });

  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error verifying payment',
      error: error.message
    });
  }
});

// Get registration by ID
router.get('/:registrationId', auth, async (req, res) => {
  try {
    const registration = await Registration.findById(req.params.registrationId)
      .populate('captain', 'firstName lastName email phone state')
      .populate('teamMembers', 'firstName lastName email phone state')
      .populate('tournament', 'name sport startDate endDate venue address entryFee organizerBankDetails');

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Check if user can access this registration
    if (registration.captain._id.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      registration
    });

  } catch (error) {
    console.error('Get registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving registration',
      error: error.message
    });
  }
});

// Cancel registration
router.delete('/:registrationId', auth, async (req, res) => {
  try {
    const registration = await Registration.findById(req.params.registrationId);
    
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Check if user owns this registration
    if (registration.captain.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only cancel your own registration'
      });
    }

    // Check if tournament has started
    const tournament = await Tournament.findById(registration.tournament);
    if (new Date() >= tournament.startDate) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel registration after tournament has started'
      });
    }

    await Registration.findByIdAndDelete(req.params.registrationId);

    // Update tournament capacity
    const approvedCount = await Registration.countDocuments({
      tournament: registration.tournament,
      status: 'Approved'
    });

    await Tournament.findByIdAndUpdate(registration.tournament, {
      currentParticipants: approvedCount,
      status: 'Open' // Reopen if was full
    });

    res.json({
      success: true,
      message: 'Registration cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error cancelling registration',
      error: error.message
    });
  }
});

module.exports = router;