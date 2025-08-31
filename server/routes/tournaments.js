const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Tournament = require('../models/Tournament');
const Team = require('../models/Team');
const Registration = require('../models/Registration');
const { auth, adminAuth } = require('../middleware/auth');
const {
  createTournament,
  updateTournament,
  getTournamentStandings,
  calculateFinalStandings,
  distributePrizes
} = require('../controllers/tournamentController');

const router = express.Router();

// Australian states for filtering
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

// Get all tournaments with advanced filtering and search
router.get('/', async (req, res) => {
  try {
    const {
      sport,
      state,
      city,
      search,
      startDate,
      endDate,
      minEntryFee,
      maxEntryFee,
      status,
      availableOnly,
      page = 1,
      limit = 12,
      sortBy = 'startDate',
      sortOrder = 'asc'
    } = req.query;

    // Build filter object
    const filter = {};

    // Sport filter
    if (sport && sport !== 'all') {
      filter.sport = sport;
    }

    // Australian state filter
    if (state && AUSTRALIAN_STATES.includes(state)) {
      filter['address.state'] = state;
    }

    // City filter (case-insensitive)
    if (city) {
      filter['address.city'] = { $regex: city, $options: 'i' };
    }

    // Search filter (name, description, venue, city)
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { venue: { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Date range filters
    if (startDate) {
      filter.startDate = { $gte: new Date(startDate) };
    }
    if (endDate) {
      filter.endDate = { $lte: new Date(endDate) };
    }

    // Entry fee range filters
    if (minEntryFee || maxEntryFee) {
      filter.entryFee = {};
      if (minEntryFee) filter.entryFee.$gte = parseFloat(minEntryFee);
      if (maxEntryFee) filter.entryFee.$lte = parseFloat(maxEntryFee);
    }

    // Status filter
    if (status) {
      filter.status = status;
    } else {
      // Default to only show open tournaments
      filter.status = { $in: ['Open', 'Draft'] };
    }

    // Available spots filter
    if (availableOnly === 'true') {
      filter.$expr = { $lt: ['$currentParticipants', '$maxParticipants'] };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with population and pagination
    const tournaments = await Tournament.find(filter)
      .populate('createdBy', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const totalCount = await Tournament.countDocuments(filter);

    // Calculate availability for each tournament
    const tournamentsWithAvailability = await Promise.all(
      tournaments.map(async (tournament) => {
        const registrationCount = await Registration.countDocuments({
          tournament: tournament._id,
          status: { $in: ['Pending', 'Approved'] }
        });

        return {
          ...tournament,
          currentParticipants: registrationCount,
          availableSpots: tournament.maxParticipants - registrationCount,
          isAvailable: registrationCount < tournament.maxParticipants,
          registrationDeadlinePassed: new Date() > new Date(tournament.registrationDeadline)
        };
      })
    );

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.json({
      tournaments: tournamentsWithAvailability,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNextPage,
        hasPrevPage,
        limit: parseInt(limit)
      },
      filters: {
        sport,
        state,
        city,
        search,
        startDate,
        endDate,
        minEntryFee,
        maxEntryFee,
        status,
        availableOnly
      }
    });
  } catch (error) {
    console.error('Tournament listing error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Search autocomplete for Australian locations
router.get('/search/locations', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ cities: [], states: [] });
    }

    // Search for cities
    const cityResults = await Tournament.aggregate([
      {
        $match: {
          'address.city': { $regex: q, $options: 'i' }
        }
      },
      {
        $group: {
          _id: {
            city: '$address.city',
            state: '$address.state'
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          city: '$_id.city',
          state: '$_id.state',
          count: 1,
          _id: 0
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]);

    // Filter states that match the query
    const matchingStates = AUSTRALIAN_STATES.filter(state => 
      state.toLowerCase().includes(q.toLowerCase())
    );

    res.json({
      cities: cityResults,
      states: matchingStates.slice(0, 5)
    });
  } catch (error) {
    console.error('Location search error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get tournament statistics for discovery
router.get('/stats/overview', async (req, res) => {
  try {
    const totalTournaments = await Tournament.countDocuments();
    const activeTournaments = await Tournament.countDocuments({ 
      status: { $in: ['Open', 'InProgress'] }
    });
    const completedTournaments = await Tournament.countDocuments({ status: 'Completed' });

    // Get popular sports
    const popularSports = await Tournament.aggregate([
      {
        $group: {
          _id: '$sport',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 6
      },
      {
        $project: {
          sport: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);

    // Get state distribution
    const stateDistribution = await Tournament.aggregate([
      {
        $group: {
          _id: '$address.state',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $project: {
          state: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);

    // Calculate total prize pool
    const totalPrizePool = await Tournament.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$prizePool.first' }
        }
      }
    ]);

    // Get total participants
    const totalParticipants = await Registration.countDocuments({
      status: { $in: ['Pending', 'Approved'] }
    });

    res.json({
      totalTournaments,
      activeTournaments,
      completedTournaments,
      totalParticipants,
      totalPrizePool: totalPrizePool[0]?.total || 0,
      popularSports,
      stateDistribution
    });
  } catch (error) {
    console.error('Tournament stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get tournament by ID with detailed information
router.get('/:id', async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email phone');
    
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    // Get registration information
    const registrations = await Registration.find({ tournament: tournament._id })
      .populate('captain', 'firstName lastName email')
      .populate('teamMembers', 'firstName lastName email');

    const approvedRegistrations = registrations.filter(reg => reg.status === 'Approved');
    const pendingRegistrations = registrations.filter(reg => reg.status === 'Pending');

    // Calculate availability
    const currentParticipants = registrations.filter(reg => 
      reg.status === 'Approved' || reg.status === 'Pending'
    ).length;
    
    const availableSpots = tournament.maxParticipants - currentParticipants;
    const isAvailable = availableSpots > 0 && new Date() <= new Date(tournament.registrationDeadline);
    const registrationDeadlinePassed = new Date() > new Date(tournament.registrationDeadline);

    // Get similar tournaments (same sport, different tournament)
    const similarTournaments = await Tournament.find({
      _id: { $ne: tournament._id },
      sport: tournament.sport,
      status: 'Open',
      startDate: { $gte: new Date() }
    })
    .limit(3)
    .select('name sport startDate address.city address.state entryFee maxParticipants currentParticipants');

    res.json({
      ...tournament.toObject(),
      registrationInfo: {
        currentParticipants,
        availableSpots,
        isAvailable,
        registrationDeadlinePassed,
        approvedCount: approvedRegistrations.length,
        pendingCount: pendingRegistrations.length
      },
      registrations: {
        approved: approvedRegistrations,
        pending: pendingRegistrations
      },
      similarTournaments
    });
  } catch (error) {
    console.error('Tournament detail error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create tournament (admin only)
router.post('/', adminAuth, [
  body('name').notEmpty().trim().withMessage('Tournament name is required'),
  body('sport').isIn([
    'Basketball', 'Football', 'Tennis', 'Volleyball', 'Cricket', 
    'Rugby', 'Netball', 'Badminton', 'Table Tennis', 'Squash'
  ]).withMessage('Invalid sport selection'),
  body('format').isIn([
    'Single Elimination', 'Double Elimination', 'Round Robin', 'Group Stage + Knockout'
  ]).withMessage('Invalid tournament format'),
  body('venue').notEmpty().trim().withMessage('Venue is required'),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required'),
  body('registrationDeadline').isISO8601().withMessage('Valid registration deadline is required'),
  body('address.street').notEmpty().trim().withMessage('Street address is required'),
  body('address.city').notEmpty().trim().withMessage('City is required'),
  body('address.state').isIn([
    'New South Wales', 'Victoria', 'Queensland', 'Western Australia',
    'South Australia', 'Tasmania', 'Australian Capital Territory', 'Northern Territory'
  ]).withMessage('Valid Australian state is required'),
  body('address.postcode').matches(/^\d{4}$/).withMessage('Valid 4-digit postcode is required'),
  body('maxParticipants').isInt({ min: 2 }).withMessage('At least 2 participants required'),
  body('entryFee').isFloat({ min: 0 }).withMessage('Entry fee must be non-negative'),
  body('prizePool.first').isFloat({ min: 0 }).withMessage('First place prize must be non-negative'),
  body('organizerBankDetails.accountName').notEmpty().trim().withMessage('Account name is required'),
  body('organizerBankDetails.bsb').matches(/^\d{3}-?\d{3}$/).withMessage('Valid BSB format required'),
  body('organizerBankDetails.accountNumber').matches(/^\d{6,10}$/).withMessage('Valid account number required'),
  body('organizerBankDetails.bankName').notEmpty().trim().withMessage('Bank name is required')
], createTournament);

// Update tournament (admin only)
router.put('/:id', adminAuth, [
  body('name').optional().notEmpty().trim(),
  body('sport').optional().isIn([
    'Basketball', 'Football', 'Tennis', 'Volleyball', 'Cricket', 
    'Rugby', 'Netball', 'Badminton', 'Table Tennis', 'Squash'
  ]),
  body('format').optional().isIn([
    'Single Elimination', 'Double Elimination', 'Round Robin', 'Group Stage + Knockout'
  ]),
  body('venue').optional().notEmpty().trim(),
  body('startDate').optional().isISO8601(),
  body('endDate').optional().isISO8601(),
  body('registrationDeadline').optional().isISO8601(),
  body('maxParticipants').optional().isInt({ min: 2 }),
  body('entryFee').optional().isFloat({ min: 0 }),
  body('prizePool.first').optional().isFloat({ min: 0 })
], updateTournament);

// Update tournament status based on capacity
router.put('/:id/capacity', auth, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    // Count current registrations
    const currentRegistrations = await Registration.countDocuments({
      tournament: tournament._id,
      status: { $in: ['Pending', 'Approved'] }
    });

    // Update tournament status based on capacity
    let newStatus = tournament.status;
    if (currentRegistrations >= tournament.maxParticipants) {
      newStatus = 'Full';
    } else if (tournament.status === 'Full' && currentRegistrations < tournament.maxParticipants) {
      newStatus = 'Open';
    }

    // Update current participants count
    const updatedTournament = await Tournament.findByIdAndUpdate(
      req.params.id,
      { 
        currentParticipants: currentRegistrations,
        status: newStatus
      },
      { new: true }
    );

    res.json({
      tournament: updatedTournament,
      currentParticipants: currentRegistrations,
      availableSpots: tournament.maxParticipants - currentRegistrations,
      statusChanged: newStatus !== tournament.status
    });
  } catch (error) {
    console.error('Tournament capacity update error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get featured tournaments for homepage
router.get('/featured/highlights', async (req, res) => {
  try {
    const { limit = 6 } = req.query;

    // Get upcoming tournaments with available spots
    const featuredTournaments = await Tournament.find({
      status: 'Open',
      startDate: { $gte: new Date() },
      registrationDeadline: { $gte: new Date() }
    })
    .sort({ startDate: 1, createdAt: -1 })
    .limit(parseInt(limit))
    .populate('createdBy', 'firstName lastName')
    .lean();

    // Add availability info
    const tournamentsWithAvailability = await Promise.all(
      featuredTournaments.map(async (tournament) => {
        const registrationCount = await Registration.countDocuments({
          tournament: tournament._id,
          status: { $in: ['Pending', 'Approved'] }
        });

        return {
          ...tournament,
          currentParticipants: registrationCount,
          availableSpots: tournament.maxParticipants - registrationCount,
          isAvailable: registrationCount < tournament.maxParticipants
        };
      })
    );

    res.json(tournamentsWithAvailability);
  } catch (error) {
    console.error('Featured tournaments error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get tournament standings
router.get('/:id/standings', auth, getTournamentStandings);

// Calculate final standings and complete tournament
router.post('/:id/calculate-standings', adminAuth, calculateFinalStandings);

// Distribute prizes
router.post('/:id/distribute-prizes', adminAuth, distributePrizes);

// Delete tournament (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const tournament = await Tournament.findByIdAndDelete(req.params.id);
    
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    // Also delete associated teams, registrations and fixtures
    await Team.deleteMany({ tournament: req.params.id });
    await Registration.deleteMany({ tournament: req.params.id });
    
    res.json({ message: 'Tournament deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;