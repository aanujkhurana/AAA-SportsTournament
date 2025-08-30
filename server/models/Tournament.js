const mongoose = require('mongoose');

const bankDetailsSchema = new mongoose.Schema({
  accountName: {
    type: String,
    required: true,
    trim: true
  },
  bsb: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        // Australian BSB format validation (XXX-XXX)
        return /^\d{3}-?\d{3}$/.test(v);
      },
      message: 'Please enter a valid Australian BSB (XXX-XXX format)'
    }
  },
  accountNumber: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        // Australian account number validation (6-10 digits)
        return /^\d{6,10}$/.test(v);
      },
      message: 'Please enter a valid Australian account number (6-10 digits)'
    }
  },
  bankName: {
    type: String,
    required: true,
    trim: true
  }
}, { _id: false });

const prizeStructureSchema = new mongoose.Schema({
  first: {
    type: Number,
    required: true,
    min: 0
  },
  second: {
    type: Number,
    min: 0
  },
  third: {
    type: Number,
    min: 0
  },
  participation: {
    type: Number,
    min: 0
  }
}, { _id: false });

const addressSchema = new mongoose.Schema({
  street: {
    type: String,
    required: true,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  state: {
    type: String,
    required: true,
    enum: [
      'New South Wales',
      'Victoria', 
      'Queensland',
      'Western Australia',
      'South Australia',
      'Tasmania',
      'Australian Capital Territory',
      'Northern Territory'
    ]
  },
  postcode: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        // Australian postcode validation (4 digits)
        return /^\d{4}$/.test(v);
      },
      message: 'Please enter a valid Australian postcode (4 digits)'
    }
  }
}, { _id: false });

const tournamentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  sport: {
    type: String,
    required: true,
    enum: [
      'Basketball',
      'Football',
      'Tennis',
      'Volleyball',
      'Cricket',
      'Rugby',
      'Netball',
      'Badminton',
      'Table Tennis',
      'Squash'
    ]
  },
  format: {
    type: String,
    required: true,
    enum: [
      'Single Elimination',
      'Double Elimination',
      'Round Robin',
      'Group Stage + Knockout'
    ]
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  registrationDeadline: {
    type: Date,
    required: true
  },
  venue: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: addressSchema,
    required: true
  },
  maxParticipants: {
    type: Number,
    required: true,
    min: 2,
    default: 16
  },
  currentParticipants: {
    type: Number,
    default: 0,
    min: 0
  },
  entryFee: {
    type: Number,
    required: true,
    min: 0
  },
  prizePool: {
    type: prizeStructureSchema,
    required: true
  },
  rules: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  organizerBankDetails: {
    type: bankDetailsSchema,
    required: true
  },
  status: {
    type: String,
    enum: ['Draft', 'Open', 'Full', 'InProgress', 'Completed'],
    default: 'Draft'
  },
  imageUrl: {
    type: String
  },
  tags: [{
    type: String,
    trim: true
  }],
  ageRestrictions: {
    minAge: {
      type: Number,
      min: 5,
      max: 100
    },
    maxAge: {
      type: Number,
      min: 5,
      max: 100
    }
  },
  skillLevelRestrictions: [{
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced', 'Professional']
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Tournament', tournamentSchema);