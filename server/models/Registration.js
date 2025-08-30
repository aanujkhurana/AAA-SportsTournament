const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
  tournament: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['Individual', 'Team']
  },
  captain: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  teamName: {
    type: String,
    trim: true,
    required: function() {
      return this.type === 'Team';
    }
  },
  teamMembers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return this.type === 'Team';
    }
  }],
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Rejected'],
    default: 'Pending'
  },
  paymentConfirmation: {
    type: String // File path for uploaded payment confirmation
  },
  paymentReference: {
    type: String,
    required: true,
    unique: true
  },
  registrationDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  notes: {
    type: String,
    trim: true
  },
  emergencyContact: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          // Australian phone number validation
          return /^(\+61|0)[2-478](?:[ -]?[0-9]){8}$/.test(v);
        },
        message: 'Please enter a valid Australian phone number'
      }
    },
    relationship: {
      type: String,
      required: true,
      trim: true
    }
  },
  medicalConditions: {
    type: String,
    trim: true
  },
  dietaryRequirements: {
    type: String,
    trim: true
  },
  shirtSize: {
    type: String,
    enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL']
  },
  teamLogo: {
    type: String // File path for team logo (only for team registrations)
  }
}, {
  timestamps: true
});

// Generate unique payment reference before saving
registrationSchema.pre('save', function(next) {
  if (!this.paymentReference) {
    // Generate unique reference: TOURN-YYYYMMDD-XXXXX
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substr(2, 5).toUpperCase();
    this.paymentReference = `TOURN-${date}-${random}`;
  }
  next();
});

// Validate team members count based on tournament sport
registrationSchema.pre('save', async function(next) {
  if (this.type === 'Team' && this.isModified('teamMembers')) {
    try {
      const tournament = await mongoose.model('Tournament').findById(this.tournament);
      if (tournament) {
        // Define minimum team sizes for different sports
        const minTeamSizes = {
          'Basketball': 5,
          'Football': 11,
          'Volleyball': 6,
          'Cricket': 11,
          'Rugby': 15,
          'Netball': 7
        };
        
        const minSize = minTeamSizes[tournament.sport] || 2;
        if (this.teamMembers.length < minSize) {
          return next(new Error(`Team must have at least ${minSize} members for ${tournament.sport}`));
        }
      }
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Index for efficient queries
registrationSchema.index({ tournament: 1, captain: 1 });
registrationSchema.index({ status: 1, paymentStatus: 1 });

module.exports = mongoose.model('Registration', registrationSchema);