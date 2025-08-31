const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');
const User = require('../models/User');
const Tournament = require('../models/Tournament');
const Registration = require('../models/Registration');
const Payment = require('../models/Payment');

describe('Payment Routes', () => {
  let authToken;
  let adminToken;
  let userId;
  let adminId;
  let tournamentId;
  let registrationId;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/tournament_test');
  });

  beforeEach(async () => {
    // Clean up database
    await User.deleteMany({});
    await Tournament.deleteMany({});
    await Registration.deleteMany({});
    await Payment.deleteMany({});

    // Create test user
    const user = new User({
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
    userId = user._id;

    // Create admin user
    const admin = new User({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@example.com',
      password: 'hashedpassword',
      phone: '0412345679',
      state: 'Victoria',
      preferredSports: ['Basketball'],
      skillLevel: 'Advanced',
      isAdmin: true
    });
    await admin.save();
    adminId = admin._id;

    // Create test tournament
    const tournament = new Tournament({
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
      createdBy: adminId
    });
    await tournament.save();
    tournamentId = tournament._id;

    // Create test registration
    const registration = new Registration({
      tournament: tournamentId,
      type: 'Individual',
      captain: userId,
      emergencyContact: {
        name: 'Jane Doe',
        phone: '0412345680',
        relationship: 'Sister'
      }
    });
    await registration.save();
    registrationId = registration._id;

    // Mock JWT tokens (in real app, these would be properly signed)
    authToken = 'mock-user-token';
    adminToken = 'mock-admin-token';
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('GET /api/payments/instructions/:registrationId', () => {
    it('should return payment instructions for a registration', async () => {
      // Mock auth middleware to return our test user
      jest.spyOn(require('../middleware/auth'), 'auth').mockImplementation((req, res, next) => {
        req.user = { _id: userId };
        next();
      });

      const response = await request(app)
        .get(`/api/payments/instructions/${registrationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.paymentInstructions).toHaveProperty('bankDetails');
      expect(response.body.paymentInstructions).toHaveProperty('paymentReference');
      expect(response.body.paymentInstructions).toHaveProperty('amount');
      expect(response.body.paymentInstructions.amount).toBe(50);
    });

    it('should return 403 for unauthorized access', async () => {
      // Mock auth middleware to return different user
      jest.spyOn(require('../middleware/auth'), 'auth').mockImplementation((req, res, next) => {
        req.user = { _id: new mongoose.Types.ObjectId() };
        next();
      });

      await request(app)
        .get(`/api/payments/instructions/${registrationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });

  describe('POST /api/payments/upload/:registrationId', () => {
    it('should upload payment confirmation successfully', async () => {
      // Mock auth middleware
      jest.spyOn(require('../middleware/auth'), 'auth').mockImplementation((req, res, next) => {
        req.user = { _id: userId };
        next();
      });

      // Create a test file buffer
      const testFile = Buffer.from('test file content');

      const response = await request(app)
        .post(`/api/payments/upload/${registrationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('paymentConfirmation', testFile, 'test-receipt.jpg')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.payment).toHaveProperty('id');
      expect(response.body.payment.verificationStatus).toBe('Pending');
    });

    it('should return 400 when no file is uploaded', async () => {
      // Mock auth middleware
      jest.spyOn(require('../middleware/auth'), 'auth').mockImplementation((req, res, next) => {
        req.user = { _id: userId };
        next();
      });

      await request(app)
        .post(`/api/payments/upload/${registrationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('GET /api/payments/status/:registrationId', () => {
    it('should return payment status for a registration', async () => {
      // Mock auth middleware
      jest.spyOn(require('../middleware/auth'), 'auth').mockImplementation((req, res, next) => {
        req.user = { _id: userId };
        next();
      });

      const response = await request(app)
        .get(`/api/payments/status/${registrationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.paymentStatus).toHaveProperty('status');
      expect(response.body.paymentStatus.status).toBe('Not Submitted');
    });
  });

  describe('PUT /api/payments/verify/:paymentId', () => {
    let paymentId;

    beforeEach(async () => {
      // Create a test payment
      const payment = new Payment({
        registration: registrationId,
        tournament: tournamentId,
        amount: 50,
        paymentReference: 'TEST-REF-123',
        confirmationFile: 'test-file.jpg'
      });
      await payment.save();
      paymentId = payment._id;
    });

    it('should verify payment successfully (admin only)', async () => {
      // Mock admin auth middleware
      jest.spyOn(require('../middleware/auth'), 'adminAuth').mockImplementation((req, res, next) => {
        req.user = { _id: adminId, isAdmin: true };
        next();
      });

      const response = await request(app)
        .put(`/api/payments/verify/${paymentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          verificationStatus: 'Verified',
          verificationNotes: 'Payment confirmed'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.payment.verificationStatus).toBe('Verified');
      expect(response.body.payment.verificationNotes).toBe('Payment confirmed');
    });

    it('should reject payment with notes', async () => {
      // Mock admin auth middleware
      jest.spyOn(require('../middleware/auth'), 'adminAuth').mockImplementation((req, res, next) => {
        req.user = { _id: adminId, isAdmin: true };
        next();
      });

      const response = await request(app)
        .put(`/api/payments/verify/${paymentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          verificationStatus: 'Rejected',
          verificationNotes: 'Invalid receipt format'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.payment.verificationStatus).toBe('Rejected');
      expect(response.body.payment.verificationNotes).toBe('Invalid receipt format');
    });
  });

  describe('GET /api/payments/pending', () => {
    beforeEach(async () => {
      // Create some test payments
      await Payment.create([
        {
          registration: registrationId,
          tournament: tournamentId,
          amount: 50,
          paymentReference: 'TEST-REF-1',
          confirmationFile: 'test-file-1.jpg',
          verificationStatus: 'Pending'
        },
        {
          registration: registrationId,
          tournament: tournamentId,
          amount: 50,
          paymentReference: 'TEST-REF-2',
          confirmationFile: 'test-file-2.jpg',
          verificationStatus: 'Verified'
        }
      ]);
    });

    it('should return only pending payments (admin only)', async () => {
      // Mock admin auth middleware
      jest.spyOn(require('../middleware/auth'), 'adminAuth').mockImplementation((req, res, next) => {
        req.user = { _id: adminId, isAdmin: true };
        next();
      });

      const response = await request(app)
        .get('/api/payments/pending')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pendingPayments).toHaveLength(1);
      expect(response.body.pendingPayments[0].verificationStatus).toBe('Pending');
    });
  });
});

// Clean up mocks after each test
afterEach(() => {
  jest.restoreAllMocks();
});