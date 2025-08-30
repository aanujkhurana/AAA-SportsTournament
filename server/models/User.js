const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
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
  preferredSports: [{
    type: String,
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
  }],
  skillLevel: {
    type: String,
    required: true,
    enum: ['Beginner', 'Intermediate', 'Advanced', 'Professional'],
    default: 'Beginner'
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  avatar: {
    type: String
  },
  dateOfBirth: {
    type: Date
  },
  emergencyContact: {
    name: {
      type: String
    },
    phone: {
      type: String
    },
    relationship: {
      type: String
    }
  },
  passwordResetToken: {
    type: String
  },
  passwordResetExpires: {
    type: Date
  }
}, {
  timestamps: true
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);