const mongoose = require('mongoose');

const matchResultSchema = new mongoose.Schema({
  participant1Score: {
    type: Number,
    required: true,
    min: 0
  },
  participant2Score: {
    type: Number,
    required: true,
    min: 0
  },
  completedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  notes: {
    type: String,
    trim: true
  },
  sets: [{
    participant1Score: Number,
    participant2Score: Number
  }], // For sports like tennis, volleyball
  overtime: {
    type: Boolean,
    default: false
  },
  forfeit: {
    type: Boolean,
    default: false
  },
  forfeitReason: {
    type: String,
    trim: true
  }
}, { _id: false });

const fixtureSchema = new mongoose.Schema({
  tournament: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true
  },
  round: {
    type: Number,
    required: true,
    min: 1
  },
  matchNumber: {
    type: Number,
    required: true,
    min: 1
  },
  participant1: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Registration',
    required: true
  },
  participant2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Registration',
    required: true
  },
  scheduledDate: {
    type: Date
  },
  venue: {
    type: String,
    trim: true
  },
  court: {
    type: String,
    trim: true
  },
  result: {
    type: matchResultSchema
  },
  status: {
    type: String,
    enum: ['Scheduled', 'InProgress', 'Completed', 'Cancelled', 'Postponed'],
    default: 'Scheduled'
  },
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Registration'
  },
  bracketPosition: {
    type: String, // e.g., "QF1", "SF1", "F1" for Quarter Final 1, Semi Final 1, Final 1
    required: true
  },
  nextMatchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Fixture' // Reference to the next match in the bracket
  },
  previousMatches: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Fixture' // References to previous matches that feed into this one
  }],
  isBye: {
    type: Boolean,
    default: false
  },
  estimatedDuration: {
    type: Number, // Duration in minutes
    default: 60
  },
  actualDuration: {
    type: Number // Actual duration in minutes
  },
  referee: {
    name: {
      type: String,
      trim: true
    },
    contact: {
      type: String,
      trim: true
    }
  },
  livestreamUrl: {
    type: String,
    trim: true
  },
  spectatorCount: {
    type: Number,
    min: 0
  }
}, {
  timestamps: true
});

// Middleware to automatically set winner and update next match
fixtureSchema.pre('save', function(next) {
  if (this.result && this.isModified('result')) {
    // Determine winner based on score
    if (this.result.participant1Score > this.result.participant2Score) {
      this.winner = this.participant1;
    } else if (this.result.participant2Score > this.result.participant1Score) {
      this.winner = this.participant2;
    }
    
    // Set status to completed if result is provided
    if (this.status !== 'Completed') {
      this.status = 'Completed';
    }
    
    // Set actual duration if not provided
    if (!this.actualDuration && this.scheduledDate) {
      const duration = Math.round((this.result.completedAt - this.scheduledDate) / (1000 * 60));
      this.actualDuration = Math.max(duration, 0);
    }
  }
  next();
});

// Post-save middleware to update next match with winner
fixtureSchema.post('save', async function(doc) {
  if (doc.winner && doc.nextMatchId && doc.isModified('winner')) {
    try {
      const nextMatch = await mongoose.model('Fixture').findById(doc.nextMatchId);
      if (nextMatch) {
        // Determine which participant slot to fill in the next match
        if (nextMatch.participant1.toString() === 'TBD' || !nextMatch.participant1) {
          nextMatch.participant1 = doc.winner;
        } else if (nextMatch.participant2.toString() === 'TBD' || !nextMatch.participant2) {
          nextMatch.participant2 = doc.winner;
        }
        await nextMatch.save();
      }
    } catch (error) {
      console.error('Error updating next match:', error);
    }
  }
});

// Validate that both participants are different
fixtureSchema.pre('save', function(next) {
  if (this.participant1 && this.participant2 && 
      this.participant1.toString() === this.participant2.toString()) {
    return next(new Error('Participants must be different'));
  }
  next();
});

// Index for efficient queries
fixtureSchema.index({ tournament: 1, round: 1 });
fixtureSchema.index({ tournament: 1, status: 1 });
fixtureSchema.index({ scheduledDate: 1 });
fixtureSchema.index({ participant1: 1 });
fixtureSchema.index({ participant2: 1 });
fixtureSchema.index({ bracketPosition: 1 });

module.exports = mongoose.model('Fixture', fixtureSchema);

module.exports = mongoose.model('Fixture', fixtureSchema);