const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Payment = require('../models/Payment');
const Registration = require('../models/Registration');
const Tournament = require('../models/Tournament');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');
const emailService = require('../services/emailService');

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
    fileSize: 10 * 1024 * 1024 // 10MB limit
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

// Get payment instructions for a registration
router.get('/instructions/:registrationId', auth, async (req, res) => {
  try {
    const registration = await Registration.findById(req.params.registrationId)
      .populate('tournament', 'name entryFee organizerBankDetails');

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
        message: 'Access denied'
      });
    }

    const paymentInstructions = {
      bankDetails: {
        accountName: registration.tournament.organizerBankDetails.accountName,
        bsb: registration.tournament.organizerBankDetails.bsb,
        accountNumber: registration.tournament.organizerBankDetails.accountNumber,
        bankName: registration.tournament.organizerBankDetails.bankName
      },
      paymentReference: registration.paymentReference,
      amount: registration.tournament.entryFee,
      tournamentName: registration.tournament.name,
      instructions: [
        `Transfer amount: $${registration.tournament.entryFee} AUD`,
        `Payment reference: ${registration.paymentReference}`,
        'Include the payment reference in your transfer description',
        'Upload your payment confirmation receipt after completing the transfer',
        'Payment verification may take 1-2 business days'
      ]
    };

    res.json({
      success: true,
      paymentInstructions
    });

  } catch (error) {
    console.error('Get payment instructions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving payment instructions',
      error: error.message
    });
  }
});

// Upload payment confirmation
router.post('/upload/:registrationId', [
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

    const registration = await Registration.findById(req.params.registrationId)
      .populate('tournament', 'name entryFee');

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

    // Check if payment already exists
    let payment = await Payment.findOne({ registration: req.params.registrationId });

    if (payment) {
      // Update existing payment with new confirmation file
      // Delete old file if exists
      if (payment.confirmationFile && fs.existsSync(payment.confirmationFile)) {
        fs.unlinkSync(payment.confirmationFile);
      }
      
      payment.confirmationFile = req.file.path;
      payment.verificationStatus = 'Pending';
      payment.verificationDate = null;
      payment.verifiedBy = null;
      payment.verificationNotes = null;
    } else {
      // Create new payment record
      payment = new Payment({
        registration: req.params.registrationId,
        tournament: registration.tournament._id,
        amount: registration.tournament.entryFee,
        paymentReference: registration.paymentReference,
        confirmationFile: req.file.path,
        transactionDate: new Date()
      });
    }

    await payment.save();

    // Update registration payment confirmation
    registration.paymentConfirmation = req.file.path;
    await registration.save();

    res.json({
      success: true,
      message: 'Payment confirmation uploaded successfully',
      payment: {
        id: payment._id,
        fileName: req.file.filename,
        uploadDate: payment.updatedAt,
        verificationStatus: payment.verificationStatus
      }
    });

  } catch (error) {
    console.error('Payment confirmation upload error:', error);
    
    // Clean up uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'Server error during file upload',
      error: error.message
    });
  }
});

// Get payment status for a registration
router.get('/status/:registrationId', auth, async (req, res) => {
  try {
    const registration = await Registration.findById(req.params.registrationId);

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Check if user owns this registration or is admin
    if (registration.captain.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const payment = await Payment.findOne({ registration: req.params.registrationId })
      .populate('verifiedBy', 'firstName lastName');

    if (!payment) {
      return res.json({
        success: true,
        paymentStatus: {
          status: 'Not Submitted',
          hasConfirmation: false,
          verificationStatus: 'Pending'
        }
      });
    }

    res.json({
      success: true,
      paymentStatus: {
        status: payment.verificationStatus,
        hasConfirmation: !!payment.confirmationFile,
        verificationStatus: payment.verificationStatus,
        verificationDate: payment.verificationDate,
        verifiedBy: payment.verifiedBy,
        verificationNotes: payment.verificationNotes,
        uploadDate: payment.createdAt,
        amount: payment.amount,
        paymentReference: payment.paymentReference
      }
    });

  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving payment status',
      error: error.message
    });
  }
});

// Get payments for a tournament (admin only)
router.get('/tournament/:tournamentId', adminAuth, async (req, res) => {
  try {
    const payments = await Payment.find({ tournament: req.params.tournamentId })
      .populate({
        path: 'registration',
        populate: [
          { path: 'captain', select: 'firstName lastName email phone' },
          { path: 'teamMembers', select: 'firstName lastName email' }
        ]
      })
      .populate('verifiedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      payments
    });

  } catch (error) {
    console.error('Get tournament payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving payments',
      error: error.message
    });
  }
});

// Verify payment (admin only)
router.put('/verify/:paymentId', [
  adminAuth,
  body('verificationStatus').isIn(['Verified', 'Rejected']).withMessage('Invalid verification status'),
  body('verificationNotes').optional().trim().isLength({ max: 500 }).withMessage('Verification notes too long')
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

    const { verificationStatus, verificationNotes } = req.body;
    
    const payment = await Payment.findById(req.params.paymentId)
      .populate({
        path: 'registration',
        populate: [
          { path: 'captain', select: 'firstName lastName email' },
          { path: 'tournament', select: 'name sport' }
        ]
      });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Update payment verification
    payment.verificationStatus = verificationStatus;
    payment.verifiedBy = req.user._id;
    payment.verificationDate = new Date();
    if (verificationNotes) {
      payment.verificationNotes = verificationNotes;
    }

    await payment.save();

    // Send payment verification email
    try {
      await emailService.sendPaymentVerificationEmail(
        payment.registration.captain,
        payment.registration.tournament,
        payment.registration,
        verificationStatus === 'Verified',
        verificationNotes
      );
    } catch (emailError) {
      console.error('Failed to send payment verification email:', emailError);
      // Don't fail the verification if email fails
    }

    res.json({
      success: true,
      message: `Payment ${verificationStatus.toLowerCase()} successfully`,
      payment
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

// Get all pending payments (admin only)
router.get('/pending', adminAuth, async (req, res) => {
  try {
    const pendingPayments = await Payment.find({ verificationStatus: 'Pending' })
      .populate({
        path: 'registration',
        populate: [
          { path: 'captain', select: 'firstName lastName email phone' },
          { path: 'teamMembers', select: 'firstName lastName' },
          { path: 'tournament', select: 'name sport entryFee' }
        ]
      })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      pendingPayments
    });

  } catch (error) {
    console.error('Get pending payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving pending payments',
      error: error.message
    });
  }
});

// Download payment confirmation file (admin only)
router.get('/download/:paymentId', adminAuth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (!payment.confirmationFile || !fs.existsSync(payment.confirmationFile)) {
      return res.status(404).json({
        success: false,
        message: 'Payment confirmation file not found'
      });
    }

    const fileName = path.basename(payment.confirmationFile);
    res.download(payment.confirmationFile, fileName);

  } catch (error) {
    console.error('Download payment confirmation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error downloading file',
      error: error.message
    });
  }
});

// Generate unique payment reference (utility endpoint)
router.get('/generate-reference', (req, res) => {
  try {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substr(2, 5).toUpperCase();
    const reference = `TOURN-${date}-${random}`;

    res.json({
      success: true,
      paymentReference: reference
    });

  } catch (error) {
    console.error('Generate payment reference error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error generating payment reference',
      error: error.message
    });
  }
});

module.exports = router;