const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  registration: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Registration',
    required: true
  },
  tournament: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentReference: {
    type: String,
    required: true
  },
  confirmationFile: {
    type: String // File path for uploaded payment confirmation (receipt/screenshot)
  },
  transactionDate: {
    type: Date,
    required: function() {
      return this.confirmationFile != null;
    }
  },
  verificationStatus: {
    type: String,
    enum: ['Pending', 'Verified', 'Rejected'],
    default: 'Pending'
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Admin who verified the payment
  },
  verificationDate: {
    type: Date
  },
  verificationNotes: {
    type: String,
    trim: true
  },
  paymentMethod: {
    type: String,
    enum: ['Bank Transfer', 'Cash', 'Other'],
    default: 'Bank Transfer'
  },
  bankTransferDetails: {
    fromAccount: {
      type: String,
      trim: true
    },
    toAccount: {
      type: String,
      trim: true
    },
    transactionId: {
      type: String,
      trim: true
    }
  },
  refundDetails: {
    isRefunded: {
      type: Boolean,
      default: false
    },
    refundAmount: {
      type: Number,
      min: 0
    },
    refundDate: {
      type: Date
    },
    refundReason: {
      type: String,
      trim: true
    },
    refundMethod: {
      type: String,
      enum: ['Bank Transfer', 'Cash', 'Other']
    }
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Middleware to update registration payment status when payment is verified
paymentSchema.post('save', async function(doc) {
  if (doc.verificationStatus === 'Verified' && doc.isModified('verificationStatus')) {
    try {
      await mongoose.model('Registration').findByIdAndUpdate(
        doc.registration,
        { paymentStatus: 'Confirmed' }
      );
    } catch (error) {
      console.error('Error updating registration payment status:', error);
    }
  } else if (doc.verificationStatus === 'Rejected' && doc.isModified('verificationStatus')) {
    try {
      await mongoose.model('Registration').findByIdAndUpdate(
        doc.registration,
        { paymentStatus: 'Rejected' }
      );
    } catch (error) {
      console.error('Error updating registration payment status:', error);
    }
  }
});

// Validate that verification date is set when status is verified/rejected
paymentSchema.pre('save', function(next) {
  if ((this.verificationStatus === 'Verified' || this.verificationStatus === 'Rejected') && 
      this.isModified('verificationStatus') && !this.verificationDate) {
    this.verificationDate = new Date();
  }
  next();
});

// Index for efficient queries
paymentSchema.index({ registration: 1 });
paymentSchema.index({ tournament: 1 });
paymentSchema.index({ paymentReference: 1 });
paymentSchema.index({ verificationStatus: 1 });
paymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);