const { body, param, query } = require('express-validator');

// Australian-specific validation patterns
const AUSTRALIAN_PHONE_REGEX = /^(\+61|0)[2-478](?:[ -]?[0-9]){8}$/;
const BSB_REGEX = /^\d{3}-?\d{3}$/;
const ACCOUNT_NUMBER_REGEX = /^\d{6,10}$/;
const POSTCODE_REGEX = /^\d{4}$/;

const AUSTRALIAN_STATES = [
  'New South Wales',
  'Victoria', 
  'Queensland',
  'Western Australia',
  'South Australia',
  'Tasmania',
  'Australian Capital Territory',
  'Northern Territory'
];

const SPORTS = [
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
];

const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Professional'];
const TOURNAMENT_FORMATS = ['Single Elimination', 'Double Elimination', 'Round Robin', 'Group Stage + Knockout'];
const TOURNAMENT_STATUSES = ['Draft', 'Open', 'Full', 'InProgress', 'Completed'];
const REGISTRATION_TYPES = ['Individual', 'Team'];
const PAYMENT_STATUSES = ['Pending', 'Confirmed', 'Rejected'];

// User validation schemas
const userRegistrationValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name is required and must be less than 50 characters'),
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name is required and must be less than 50 characters'),
  body('phone')
    .matches(AUSTRALIAN_PHONE_REGEX)
    .withMessage('Please provide a valid Australian phone number'),
  body('state')
    .isIn(AUSTRALIAN_STATES)
    .withMessage('Please select a valid Australian state or territory'),
  body('preferredSports')
    .isArray({ min: 1 })
    .withMessage('Please select at least one preferred sport'),
  body('preferredSports.*')
    .isIn(SPORTS)
    .withMessage('Please select valid sports'),
  body('skillLevel')
    .isIn(SKILL_LEVELS)
    .withMessage('Please select a valid skill level'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date of birth'),
  body('emergencyContact.name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Emergency contact name must be less than 100 characters'),
  body('emergencyContact.phone')
    .optional()
    .matches(AUSTRALIAN_PHONE_REGEX)
    .withMessage('Please provide a valid Australian phone number for emergency contact'),
  body('emergencyContact.relationship')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Emergency contact relationship must be less than 50 characters')
];

const userUpdateValidation = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be less than 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be less than 50 characters'),
  body('phone')
    .optional()
    .matches(AUSTRALIAN_PHONE_REGEX)
    .withMessage('Please provide a valid Australian phone number'),
  body('state')
    .optional()
    .isIn(AUSTRALIAN_STATES)
    .withMessage('Please select a valid Australian state or territory'),
  body('preferredSports')
    .optional()
    .isArray({ min: 1 })
    .withMessage('Please select at least one preferred sport'),
  body('preferredSports.*')
    .optional()
    .isIn(SPORTS)
    .withMessage('Please select valid sports'),
  body('skillLevel')
    .optional()
    .isIn(SKILL_LEVELS)
    .withMessage('Please select a valid skill level')
];

// Tournament validation schemas
const tournamentCreateValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Tournament name is required and must be less than 100 characters'),
  body('sport')
    .isIn(SPORTS)
    .withMessage('Please select a valid sport'),
  body('format')
    .isIn(TOURNAMENT_FORMATS)
    .withMessage('Please select a valid tournament format'),
  body('startDate')
    .isISO8601()
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Start date must be in the future');
      }
      return true;
    }),
  body('endDate')
    .isISO8601()
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  body('registrationDeadline')
    .isISO8601()
    .custom((value, { req }) => {
      if (new Date(value) >= new Date(req.body.startDate)) {
        throw new Error('Registration deadline must be before start date');
      }
      return true;
    }),
  body('venue')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Venue is required and must be less than 200 characters'),
  body('address.street')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Street address is required'),
  body('address.city')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('City is required'),
  body('address.state')
    .isIn(AUSTRALIAN_STATES)
    .withMessage('Please select a valid Australian state or territory'),
  body('address.postcode')
    .matches(POSTCODE_REGEX)
    .withMessage('Please provide a valid Australian postcode'),
  body('maxParticipants')
    .isInt({ min: 2, max: 1000 })
    .withMessage('Maximum participants must be between 2 and 1000'),
  body('entryFee')
    .isFloat({ min: 0 })
    .withMessage('Entry fee must be a positive number'),
  body('prizePool.first')
    .isFloat({ min: 0 })
    .withMessage('First prize must be a positive number'),
  body('prizePool.second')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Second prize must be a positive number'),
  body('prizePool.third')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Third prize must be a positive number'),
  body('rules')
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage('Rules are required and must be between 10 and 5000 characters'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description is required and must be between 10 and 2000 characters'),
  body('organizerBankDetails.accountName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Account name is required'),
  body('organizerBankDetails.bsb')
    .matches(BSB_REGEX)
    .withMessage('Please provide a valid Australian BSB (XXX-XXX format)'),
  body('organizerBankDetails.accountNumber')
    .matches(ACCOUNT_NUMBER_REGEX)
    .withMessage('Please provide a valid Australian account number'),
  body('organizerBankDetails.bankName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Bank name is required')
];

// Registration validation schemas
const registrationCreateValidation = [
  body('tournamentId')
    .isMongoId()
    .withMessage('Please provide a valid tournament ID'),
  body('type')
    .isIn(REGISTRATION_TYPES)
    .withMessage('Please select a valid registration type'),
  body('teamName')
    .if(body('type').equals('Team'))
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Team name is required for team registrations'),
  body('teamMembers')
    .if(body('type').equals('Team'))
    .isArray({ min: 1 })
    .withMessage('Team members are required for team registrations'),
  body('teamMembers.*')
    .if(body('type').equals('Team'))
    .isMongoId()
    .withMessage('Please provide valid team member IDs'),
  body('emergencyContact.name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Emergency contact name is required'),
  body('emergencyContact.phone')
    .matches(AUSTRALIAN_PHONE_REGEX)
    .withMessage('Please provide a valid Australian phone number for emergency contact'),
  body('emergencyContact.relationship')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Emergency contact relationship is required'),
  body('medicalConditions')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Medical conditions must be less than 500 characters'),
  body('dietaryRequirements')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Dietary requirements must be less than 500 characters'),
  body('shirtSize')
    .optional()
    .isIn(['XS', 'S', 'M', 'L', 'XL', 'XXL'])
    .withMessage('Please select a valid shirt size')
];

// Payment validation schemas
const paymentConfirmationValidation = [
  body('registrationId')
    .isMongoId()
    .withMessage('Please provide a valid registration ID'),
  body('paymentReference')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Payment reference is required'),
  body('transactionDate')
    .isISO8601()
    .withMessage('Please provide a valid transaction date'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters')
];

const paymentVerificationValidation = [
  body('status')
    .isIn(['Verified', 'Rejected'])
    .withMessage('Please select a valid verification status'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Verification notes must be less than 500 characters')
];

// Fixture validation schemas
const fixtureCreateValidation = [
  body('tournamentId')
    .isMongoId()
    .withMessage('Please provide a valid tournament ID'),
  body('round')
    .isInt({ min: 1 })
    .withMessage('Round must be a positive integer'),
  body('matchNumber')
    .isInt({ min: 1 })
    .withMessage('Match number must be a positive integer'),
  body('participant1')
    .isMongoId()
    .withMessage('Please provide a valid participant 1 ID'),
  body('participant2')
    .isMongoId()
    .withMessage('Please provide a valid participant 2 ID'),
  body('scheduledDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid scheduled date'),
  body('venue')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Venue must be less than 200 characters'),
  body('bracketPosition')
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Bracket position is required')
];

const matchResultValidation = [
  body('participant1Score')
    .isInt({ min: 0 })
    .withMessage('Participant 1 score must be a non-negative integer'),
  body('participant2Score')
    .isInt({ min: 0 })
    .withMessage('Participant 2 score must be a non-negative integer'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters'),
  body('overtime')
    .optional()
    .isBoolean()
    .withMessage('Overtime must be a boolean value'),
  body('forfeit')
    .optional()
    .isBoolean()
    .withMessage('Forfeit must be a boolean value'),
  body('forfeitReason')
    .if(body('forfeit').equals(true))
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Forfeit reason is required when forfeit is true')
];

// Common parameter validations
const mongoIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Please provide a valid ID')
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

module.exports = {
  userRegistrationValidation,
  userUpdateValidation,
  tournamentCreateValidation,
  registrationCreateValidation,
  paymentConfirmationValidation,
  paymentVerificationValidation,
  fixtureCreateValidation,
  matchResultValidation,
  mongoIdValidation,
  paginationValidation
};