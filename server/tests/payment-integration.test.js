const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Registration = require('../models/Registration');
const Tournament = require('../models/Tournament');
const User = require('../models/User');

describe('Payment System Integration', () => {
  let user, tournament, registration;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/tournament_test');
    }
  });

  beforeEach(async () => {
    // Clean up
    await Payment.deleteMany({});
    await Registration.deleteMany({});
    await Tournament.deleteMany({});
    await User.deleteMany({});

    // Create test data
    user = new User({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password: 'hashedpassword',
      phone: '0412345678',
      state: 'New South Wales',
      preferredSports: ['Basketball'],
      skillLevel: 'Intermediate'
    });
    await user.save();

    tournament = new Tournament({
      name: 'Test Tournament',
      sport: 'Basketball',
      format: 'Single Elimination',
      startDate: new Date('2024-12-01'),
      endDate: new Date('2024-12-02'),
      registrationDeadline: new Date('2024-11-25'),
      venue: 'Test Venue',
      address: {
        street: '123 Test St',
        city: 'Sydney',
        state: 'New South Wales',
        postcode: '2000'
      },
      maxParticipants: 16,
      entryFee: 50,
      prizePool: {
        first: 200,
        second: 100,
        third: 50
      },
      rules: 'Test rules',
      description: 'Test tournament',
      organizerBankDetails: {
        accountName: 'Test Organizer',
        bsb: '123-456',
        accountNumber: '12345678',
        bankName: 'Test Bank'
      },
      status: 'Open',
      createdBy: user._id
    });
    await tournament.save();

    registration = new Registration({
      tournament: tournament._id,
      type: 'Individual',
      captain: user._id,
      emergencyContact: {
        name: 'Jane Doe',
        phone: '0412345680',
        relationship: 'Sister'
      }
    });
    await registration.save();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test('should create payment with correct reference', async () => {
    const payment = new Payment({
      registration: registration._id,
      tournament: tournament._id,
      amount: tournament.entryFee,
      paymentReference: registration.paymentReference,
      confirmationFile: 'test-receipt.jpg'
    });

    await payment.save();

    expect(payment._id).toBeDefined();
    expect(payment.amount).toBe(50);
    expect(payment.paymentReference).toBe(registration.paymentReference);
    expect(payment.verificationStatus).toBe('Pending');
  });

  test('should update registration payment status when payment is verified', async () => {
    const payment = new Payment({
      registration: registration._id,
      tournament: tournament._id,
      amount: tournament.entryFee,
      paymentReference: registration.paymentReference,
      confirmationFile: 'test-receipt.jpg'
    });

    await payment.save();

    // Verify payment
    payment.verificationStatus = 'Verified';
    payment.verifiedBy = user._id;
    await payment.save();

    // Check if registration was updated
    const updatedRegistration = await Registration.findById(registration._id);
    expect(updatedRegistration.paymentStatus).toBe('Confirmed');
  });

  test('should generate unique payment references', async () => {
    const registration2 = new Registration({
      tournament: tournament._id,
      type: 'Individual',
      captain: user._id,
      emergencyContact: {
        name: 'Jane Doe',
        phone: '0412345680',
        relationship: 'Sister'
      }
    });
    await registration2.save();

    expect(registration.paymentReference).toBeDefined();
    expect(registration2.paymentReference).toBeDefined();
    expect(registration.paymentReference).not.toBe(registration2.paymentReference);
    expect(registration.paymentReference).toMatch(/^TOURN-\d{8}-[A-Z0-9]{5}$/);
  });

  test('should validate payment amount matches tournament entry fee', async () => {
    const payment = new Payment({
      registration: registration._id,
      tournament: tournament._id,
      amount: tournament.entryFee,
      paymentReference: registration.paymentReference,
      confirmationFile: 'test-receipt.jpg'
    });

    await payment.save();
    expect(payment.amount).toBe(tournament.entryFee);
  });

  test('should handle payment rejection', async () => {
    const payment = new Payment({
      registration: registration._id,
      tournament: tournament._id,
      amount: tournament.entryFee,
      paymentReference: registration.paymentReference,
      confirmationFile: 'test-receipt.jpg'
    });

    await payment.save();

    // Reject payment
    payment.verificationStatus = 'Rejected';
    payment.verifiedBy = user._id;
    payment.verificationNotes = 'Invalid receipt format';
    await payment.save();

    // Check if registration was updated
    const updatedRegistration = await Registration.findById(registration._id);
    expect(updatedRegistration.paymentStatus).toBe('Rejected');
    expect(payment.verificationNotes).toBe('Invalid receipt format');
  });
});