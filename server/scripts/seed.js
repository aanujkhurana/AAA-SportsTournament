const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models using the new structure
const { User, Tournament, Registration, Payment, Fixture } = require('../models');

const seedData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tournament_manager');
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Tournament.deleteMany({});
    await Registration.deleteMany({});
    await Payment.deleteMany({});
    await Fixture.deleteMany({});
    console.log('Cleared existing data');

    // Create admin user
    const adminUser = new User({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@sportstourneys.com',
      password: 'admin123',
      phone: '+61 412 000 000',
      state: 'New South Wales',
      preferredSports: ['Basketball', 'Football'],
      skillLevel: 'Advanced',
      isAdmin: true,
      isVerified: true,
      emergencyContact: {
        name: 'Emergency Contact',
        phone: '+61 412 000 001',
        relationship: 'Colleague'
      }
    });
    await adminUser.save();
    console.log('Created admin user');

    // Create sample players with Australian data
    const players = [
      {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'password123',
        phone: '+61 412 123 456',
        state: 'New South Wales',
        preferredSports: ['Basketball', 'Tennis'],
        skillLevel: 'Intermediate',
        isVerified: true,
        emergencyContact: {
          name: 'Mary Doe',
          phone: '+61 412 123 457',
          relationship: 'Spouse'
        }
      },
      {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        password: 'password123',
        phone: '+61 423 234 567',
        state: 'Victoria',
        preferredSports: ['Football', 'Netball'],
        skillLevel: 'Advanced',
        isVerified: true,
        emergencyContact: {
          name: 'Robert Smith',
          phone: '+61 423 234 568',
          relationship: 'Father'
        }
      },
      {
        firstName: 'Mike',
        lastName: 'Johnson',
        email: 'mike@example.com',
        password: 'password123',
        phone: '+61 434 345 678',
        state: 'Queensland',
        preferredSports: ['Cricket', 'Rugby'],
        skillLevel: 'Professional',
        isVerified: true,
        emergencyContact: {
          name: 'Lisa Johnson',
          phone: '+61 434 345 679',
          relationship: 'Sister'
        }
      },
      {
        firstName: 'Sarah',
        lastName: 'Wilson',
        email: 'sarah@example.com',
        password: 'password123',
        phone: '+61 445 456 789',
        state: 'Western Australia',
        preferredSports: ['Volleyball', 'Badminton'],
        skillLevel: 'Beginner',
        isVerified: true,
        emergencyContact: {
          name: 'David Wilson',
          phone: '+61 445 456 790',
          relationship: 'Brother'
        }
      },
      {
        firstName: 'David',
        lastName: 'Brown',
        email: 'david@example.com',
        password: 'password123',
        phone: '+61 456 567 890',
        state: 'South Australia',
        preferredSports: ['Tennis', 'Squash'],
        skillLevel: 'Intermediate',
        isVerified: true,
        emergencyContact: {
          name: 'Emma Brown',
          phone: '+61 456 567 891',
          relationship: 'Wife'
        }
      },
      {
        firstName: 'Lisa',
        lastName: 'Davis',
        email: 'lisa@example.com',
        password: 'password123',
        phone: '+61 467 678 901',
        state: 'Tasmania',
        preferredSports: ['Basketball', 'Volleyball'],
        skillLevel: 'Advanced',
        isVerified: true,
        emergencyContact: {
          name: 'Tom Davis',
          phone: '+61 467 678 902',
          relationship: 'Husband'
        }
      }
    ];

    const createdPlayers = [];
    for (const playerData of players) {
      const player = new User(playerData);
      await player.save();
      createdPlayers.push(player);
    }
    console.log('Created sample players');

    // Create sample tournaments with Australian locations and bank details
    const tournaments = [
      {
        name: 'Sydney Summer Basketball Championship',
        sport: 'Basketball',
        format: 'Single Elimination',
        startDate: new Date('2025-03-15'),
        endDate: new Date('2025-03-17'),
        registrationDeadline: new Date('2025-03-10'),
        venue: 'Sydney Olympic Park Sports Centre',
        address: {
          street: '1 Olympic Boulevard',
          city: 'Sydney',
          state: 'New South Wales',
          postcode: '2127'
        },
        maxParticipants: 16,
        entryFee: 150,
        prizePool: {
          first: 2000,
          second: 1200,
          third: 800
        },
        rules: 'Standard FIBA basketball rules apply. Games are 4 x 10 minute quarters.',
        description: 'Annual summer basketball tournament featuring teams from across Sydney and NSW.',
        organizerBankDetails: {
          accountName: 'Sydney Basketball Association',
          bsb: '062-001',
          accountNumber: '12345678',
          bankName: 'Commonwealth Bank'
        },
        status: 'Open',
        tags: ['Summer', 'Championship', 'Sydney'],
        createdBy: adminUser._id
      },
      {
        name: 'Melbourne Football Premier League',
        sport: 'Football',
        format: 'Round Robin',
        startDate: new Date('2025-04-01'),
        endDate: new Date('2025-06-30'),
        registrationDeadline: new Date('2025-03-25'),
        venue: 'Melbourne Sports Complex',
        address: {
          street: '123 Sports Avenue',
          city: 'Melbourne',
          state: 'Victoria',
          postcode: '3000'
        },
        maxParticipants: 12,
        entryFee: 300,
        prizePool: {
          first: 5000,
          second: 3000,
          third: 2000
        },
        rules: 'FIFA standard rules. Each team plays every other team once.',
        description: 'Professional football league for Melbourne metropolitan teams.',
        organizerBankDetails: {
          accountName: 'Melbourne Football League',
          bsb: '033-001',
          accountNumber: '87654321',
          bankName: 'Westpac Banking Corporation'
        },
        status: 'Open',
        tags: ['Professional', 'League', 'Melbourne'],
        createdBy: adminUser._id
      },
      {
        name: 'Brisbane Tennis Open',
        sport: 'Tennis',
        format: 'Single Elimination',
        startDate: new Date('2025-05-10'),
        endDate: new Date('2025-05-12'),
        registrationDeadline: new Date('2025-05-05'),
        venue: 'Queensland Tennis Centre',
        address: {
          street: '190 King Arthur Terrace',
          city: 'Brisbane',
          state: 'Queensland',
          postcode: '4059'
        },
        maxParticipants: 32,
        entryFee: 75,
        prizePool: {
          first: 1500,
          second: 900,
          third: 600
        },
        rules: 'ITF tennis rules. Best of 3 sets format.',
        description: 'Open tennis tournament for individual players of all skill levels.',
        organizerBankDetails: {
          accountName: 'Queensland Tennis Association',
          bsb: '064-001',
          accountNumber: '11223344',
          bankName: 'ANZ Banking Group'
        },
        status: 'Open',
        tags: ['Individual', 'Open', 'Brisbane'],
        createdBy: adminUser._id
      }
    ];

    const createdTournaments = [];
    for (const tournamentData of tournaments) {
      const tournament = new Tournament(tournamentData);
      await tournament.save();
      createdTournaments.push(tournament);
    }
    console.log('Created sample tournaments');

    // Create sample registrations
    const basketballTournament = createdTournaments[0];
    const tennisTournament = createdTournaments[2];
    
    const registrations = [
      // Team registration for basketball
      {
        tournament: basketballTournament._id,
        type: 'Team',
        captain: createdPlayers[0]._id, // John Doe
        teamName: 'Thunder Bolts',
        teamMembers: [createdPlayers[0]._id, createdPlayers[2]._id, createdPlayers[4]._id], // John, Mike, David
        paymentStatus: 'Confirmed',
        status: 'Approved',
        emergencyContact: {
          name: 'Mary Doe',
          phone: '+61 412 123 457',
          relationship: 'Spouse'
        },
        shirtSize: 'L'
      },
      // Individual registration for tennis
      {
        tournament: tennisTournament._id,
        type: 'Individual',
        captain: createdPlayers[1]._id, // Jane Smith
        paymentStatus: 'Pending',
        status: 'Pending',
        emergencyContact: {
          name: 'Robert Smith',
          phone: '+61 423 234 568',
          relationship: 'Father'
        },
        medicalConditions: 'None',
        shirtSize: 'M'
      },
      // Another team registration for basketball
      {
        tournament: basketballTournament._id,
        type: 'Team',
        captain: createdPlayers[3]._id, // Sarah Wilson
        teamName: 'Court Kings',
        teamMembers: [createdPlayers[3]._id, createdPlayers[5]._id], // Sarah, Lisa
        paymentStatus: 'Pending',
        status: 'Pending',
        emergencyContact: {
          name: 'David Wilson',
          phone: '+61 445 456 790',
          relationship: 'Brother'
        },
        shirtSize: 'S'
      }
    ];

    const createdRegistrations = [];
    for (const regData of registrations) {
      const registration = new Registration(regData);
      await registration.save();
      createdRegistrations.push(registration);
    }
    console.log('Created sample registrations');

    // Create sample payments
    const payments = [
      // Confirmed payment for basketball team
      {
        registration: createdRegistrations[0]._id,
        tournament: basketballTournament._id,
        amount: 150,
        paymentReference: createdRegistrations[0].paymentReference,
        confirmationFile: '/uploads/payments/basketball-team-receipt.jpg',
        transactionDate: new Date('2025-02-20'),
        verificationStatus: 'Verified',
        verifiedBy: adminUser._id,
        verificationDate: new Date('2025-02-21'),
        verificationNotes: 'Payment confirmed via bank statement'
      },
      // Pending payment for tennis individual
      {
        registration: createdRegistrations[1]._id,
        tournament: tennisTournament._id,
        amount: 75,
        paymentReference: createdRegistrations[1].paymentReference,
        verificationStatus: 'Pending'
      }
    ];

    const createdPayments = [];
    for (const paymentData of payments) {
      const payment = new Payment(paymentData);
      await payment.save();
      createdPayments.push(payment);
    }
    console.log('Created sample payments');

    // Create sample fixtures for basketball tournament
    const fixtures = [
      {
        tournament: basketballTournament._id,
        round: 1,
        matchNumber: 1,
        participant1: createdRegistrations[0]._id, // Thunder Bolts
        participant2: createdRegistrations[2]._id, // Court Kings
        scheduledDate: new Date('2025-03-15T10:00:00Z'),
        venue: 'Sydney Olympic Park Sports Centre - Court 1',
        bracketPosition: 'SF1',
        status: 'Scheduled'
      }
    ];

    const createdFixtures = [];
    for (const fixtureData of fixtures) {
      const fixture = new Fixture(fixtureData);
      await fixture.save();
      createdFixtures.push(fixture);
    }
    console.log('Created sample fixtures');

    // Update tournament participant counts
    await Tournament.findByIdAndUpdate(basketballTournament._id, { currentParticipants: 2 });
    await Tournament.findByIdAndUpdate(tennisTournament._id, { currentParticipants: 1 });

    console.log('\n=== Seed Data Summary ===');
    console.log(`Admin User: admin@sportstourneys.com / admin123`);
    console.log(`Sample Players: ${createdPlayers.length} created`);
    console.log(`Tournaments: ${createdTournaments.length} created`);
    console.log(`Registrations: ${createdRegistrations.length} created`);
    console.log(`Payments: ${createdPayments.length} created`);
    console.log(`Fixtures: ${createdFixtures.length} created`);
    console.log('\n🏆 Tournament Details:');
    console.log(`- Sydney Basketball Championship: ${basketballTournament.name}`);
    console.log(`- Brisbane Tennis Open: ${tennisTournament.name}`);
    console.log('\nSeed data created successfully!');

  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the seed function
seedData();