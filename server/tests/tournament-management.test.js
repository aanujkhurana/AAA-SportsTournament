const request = require('supertest');
const mongoose = require('mongoose');
const Tournament = require('../models/Tournament');
const User = require('../models/User');
const Registration = require('../models/Registration');
const Fixture = require('../models/Fixture');

// Create a test app without starting the server
const express = require('express');
const cors = require('cors');
const tournamentRoutes = require('../routes/tournaments');
const fixtureRoutes = require('../routes/fixtures');
const authRoutes = require('../routes/auth');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/fixtures', fixtureRoutes);

describe('Tournament Management', () => {
  let adminUser, adminToken, tournament;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/tournament_test');
    }

    // Clear test data
    await User.deleteMany({});
    await Tournament.deleteMany({});
    await Registration.deleteMany({});
    await Fixture.deleteMany({});

    // Create admin user
    adminUser = new User({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@test.com',
      password: 'password123',
      phone: '+61412345678',
      state: 'New South Wales',
      isAdmin: true,
      isVerified: true
    });
    await adminUser.save();

    // Login to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'password123'
      });

    adminToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Tournament Creation', () => {
    test('should create tournament with valid data', async () => {
      const tournamentData = {
        name: 'Test Basketball Tournament',
        sport: 'Basketball',
        format: 'Single Elimination',
        description: 'A test tournament for basketball players',
        rules: 'Standard basketball rules apply',
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
        endDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000), // 9 days from now
        registrationDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        venue: 'Test Sports Centre',
        address: {
          street: '123 Test Street',
          city: 'Sydney',
          state: 'New South Wales',
          postcode: '2000'
        },
        maxParticipants: 16,
        entryFee: 50,
        prizePool: {
          first: 500,
          second: 300,
          third: 200
        },
        organizerBankDetails: {
          accountName: 'Test Tournament Organizer',
          bsb: '123-456',
          accountNumber: '12345678',
          bankName: 'Test Bank'
        }
      };

      const response = await request(app)
        .post('/api/tournaments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(tournamentData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(tournamentData.name);
      expect(response.body.data.sport).toBe(tournamentData.sport);
      expect(response.body.data.status).toBe('Draft');

      tournament = response.body.data;
    });

    test('should reject tournament creation with invalid data', async () => {
      const invalidData = {
        name: '', // Empty name
        sport: 'InvalidSport',
        format: 'InvalidFormat'
      };

      const response = await request(app)
        .post('/api/tournaments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Tournament Update', () => {
    test('should update tournament details', async () => {
      const updateData = {
        name: 'Updated Basketball Tournament',
        description: 'Updated description for the tournament'
      };

      const response = await request(app)
        .put(`/api/tournaments/${tournament._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.description).toBe(updateData.description);
    });

    test('should prevent unauthorized tournament updates', async () => {
      const updateData = {
        name: 'Unauthorized Update'
      };

      const response = await request(app)
        .put(`/api/tournaments/${tournament._id}`)
        .send(updateData); // No authorization header

      expect(response.status).toBe(401);
    });
  });

  describe('Tournament Standings', () => {
    test('should get empty standings for new tournament', async () => {
      const response = await request(app)
        .get(`/api/tournaments/${tournament._id}/standings`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(0);
    });
  });

  describe('Fixture Generation', () => {
    let registrations;

    beforeAll(async () => {
      // Create test registrations
      const users = [];
      for (let i = 1; i <= 4; i++) {
        const user = new User({
          firstName: `Player${i}`,
          lastName: 'Test',
          email: `player${i}@test.com`,
          password: 'password123',
          phone: `+6141234567${i}`,
          state: 'New South Wales',
          isVerified: true
        });
        await user.save();
        users.push(user);
      }

      registrations = [];
      for (const user of users) {
        const registration = new Registration({
          tournament: tournament._id,
          type: 'Individual',
          captain: user._id,
          paymentStatus: 'Confirmed',
          paymentReference: `TEST-REF-${user._id}`,
          status: 'Approved'
        });
        await registration.save();
        registrations.push(registration);
      }
    });

    test('should generate fixtures for tournament', async () => {
      const fixtureData = {
        fixtures: [
          {
            round: 1,
            matchNumber: 1,
            participant1: registrations[0],
            participant2: registrations[1],
            scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            venue: tournament.venue,
            court: 'Court 1',
            bracketPosition: 'SF1'
          },
          {
            round: 1,
            matchNumber: 2,
            participant1: registrations[2],
            participant2: registrations[3],
            scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            venue: tournament.venue,
            court: 'Court 2',
            bracketPosition: 'SF2'
          }
        ],
        settings: {
          startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          matchDuration: 60,
          breakBetweenMatches: 15,
          venue: tournament.venue,
          courts: ['Court 1', 'Court 2']
        }
      };

      const response = await request(app)
        .post(`/api/fixtures/generate/${tournament._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(fixtureData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(2);
    });

    test('should get tournament fixtures', async () => {
      const response = await request(app)
        .get(`/api/fixtures/tournament/${tournament._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(2);
    });
  });

  describe('Match Results', () => {
    let fixture;

    beforeAll(async () => {
      // Get the first fixture
      const fixtures = await Fixture.find({ tournament: tournament._id });
      fixture = fixtures[0];
    });

    test('should update match result', async () => {
      const resultData = {
        result: {
          participant1Score: 21,
          participant2Score: 18,
          completedAt: new Date(),
          notes: 'Great match!'
        },
        status: 'Completed'
      };

      const response = await request(app)
        .put(`/api/fixtures/${fixture._id}/result`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(resultData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.result.participant1Score).toBe(21);
      expect(response.body.data.result.participant2Score).toBe(18);
      expect(response.body.data.status).toBe('Completed');
      expect(response.body.data.winner).toBeDefined();
    });

    test('should update fixture status', async () => {
      const statusData = {
        status: 'InProgress'
      };

      const response = await request(app)
        .put(`/api/fixtures/${fixture._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(statusData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('InProgress');
    });
  });

  describe('Tournament Completion', () => {
    test('should calculate final standings', async () => {
      const response = await request(app)
        .post(`/api/tournaments/${tournament._id}/calculate-standings`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should initiate prize distribution', async () => {
      const prizeData = {
        standings: [
          { participant: registrations[0], position: 1 },
          { participant: registrations[1], position: 2 }
        ],
        bankDetails: {}
      };

      const response = await request(app)
        .post(`/api/tournaments/${tournament._id}/distribute-prizes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(prizeData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.winners).toBe(2);
    });
  });
});