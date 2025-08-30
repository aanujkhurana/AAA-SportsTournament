const express = require('express');
const { body, validationResult } = require('express-validator');
const Fixture = require('../models/Fixture');
const Tournament = require('../models/Tournament');
const Team = require('../models/Team');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get fixtures for a tournament
router.get('/tournament/:tournamentId', async (req, res) => {
  try {
    const fixtures = await Fixture.find({ tournament: req.params.tournamentId })
      .populate('homeTeam', 'name')
      .populate('awayTeam', 'name')
      .populate('winner', 'name')
      .sort({ matchNumber: 1 });
    
    res.json(fixtures);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get fixture by ID
router.get('/:id', async (req, res) => {
  try {
    const fixture = await Fixture.findById(req.params.id)
      .populate('tournament', 'name sport')
      .populate('homeTeam', 'name players')
      .populate('awayTeam', 'name players')
      .populate('winner', 'name');
    
    if (!fixture) {
      return res.status(404).json({ message: 'Fixture not found' });
    }

    res.json(fixture);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create fixture (admin only)
router.post('/', adminAuth, [
  body('tournament').isMongoId(),
  body('round').notEmpty().trim(),
  body('matchNumber').isInt({ min: 1 }),
  body('homeTeam').isMongoId(),
  body('awayTeam').isMongoId(),
  body('scheduledDate').isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Validate that teams are different
    if (req.body.homeTeam === req.body.awayTeam) {
      return res.status(400).json({ message: 'Home and away teams must be different' });
    }

    // Validate that teams belong to the tournament
    const homeTeam = await Team.findOne({ 
      _id: req.body.homeTeam, 
      tournament: req.body.tournament 
    });
    const awayTeam = await Team.findOne({ 
      _id: req.body.awayTeam, 
      tournament: req.body.tournament 
    });

    if (!homeTeam || !awayTeam) {
      return res.status(400).json({ message: 'Teams must belong to the tournament' });
    }

    const fixture = new Fixture(req.body);
    await fixture.save();
    
    await fixture.populate([
      { path: 'tournament', select: 'name sport' },
      { path: 'homeTeam', select: 'name' },
      { path: 'awayTeam', select: 'name' }
    ]);

    res.status(201).json(fixture);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update fixture score (admin only)
router.put('/:id/score', adminAuth, [
  body('homeScore').isInt({ min: 0 }),
  body('awayScore').isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { homeScore, awayScore, status } = req.body;
    
    const updateData = {
      homeScore,
      awayScore,
      status: status || 'completed'
    };

    // Determine winner
    if (homeScore > awayScore) {
      const fixture = await Fixture.findById(req.params.id);
      updateData.winner = fixture.homeTeam;
    } else if (awayScore > homeScore) {
      const fixture = await Fixture.findById(req.params.id);
      updateData.winner = fixture.awayTeam;
    }

    const fixture = await Fixture.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate([
      { path: 'tournament', select: 'name sport' },
      { path: 'homeTeam', select: 'name' },
      { path: 'awayTeam', select: 'name' },
      { path: 'winner', select: 'name' }
    ]);

    if (!fixture) {
      return res.status(404).json({ message: 'Fixture not found' });
    }

    res.json(fixture);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update fixture details (admin only)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const fixture = await Fixture.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate([
      { path: 'tournament', select: 'name sport' },
      { path: 'homeTeam', select: 'name' },
      { path: 'awayTeam', select: 'name' },
      { path: 'winner', select: 'name' }
    ]);

    if (!fixture) {
      return res.status(404).json({ message: 'Fixture not found' });
    }

    res.json(fixture);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete fixture (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const fixture = await Fixture.findByIdAndDelete(req.params.id);
    
    if (!fixture) {
      return res.status(404).json({ message: 'Fixture not found' });
    }

    res.json({ message: 'Fixture deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Generate fixtures for tournament (admin only)
router.post('/generate/:tournamentId', adminAuth, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.tournamentId);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    const teams = await Team.find({ 
      tournament: req.params.tournamentId,
      status: 'confirmed'
    });

    if (teams.length < 2) {
      return res.status(400).json({ message: 'At least 2 confirmed teams required' });
    }

    // Clear existing fixtures
    await Fixture.deleteMany({ tournament: req.params.tournamentId });

    const fixtures = [];
    let matchNumber = 1;

    if (tournament.format === 'league') {
      // Round-robin format
      for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
          const scheduledDate = new Date(tournament.startDate);
          scheduledDate.setDate(scheduledDate.getDate() + Math.floor((matchNumber - 1) / 2));

          fixtures.push({
            tournament: req.params.tournamentId,
            round: 'League',
            matchNumber: matchNumber++,
            homeTeam: teams[i]._id,
            awayTeam: teams[j]._id,
            scheduledDate,
            venue: tournament.location
          });
        }
      }
    } else if (tournament.format === 'knockout') {
      // Single elimination
      const rounds = Math.ceil(Math.log2(teams.length));
      let currentRound = teams.slice();
      
      for (let round = 1; round <= rounds; round++) {
        const roundName = round === rounds ? 'Final' : 
                         round === rounds - 1 ? 'Semi-Final' : 
                         `Round ${round}`;
        
        for (let i = 0; i < currentRound.length; i += 2) {
          if (i + 1 < currentRound.length) {
            const scheduledDate = new Date(tournament.startDate);
            scheduledDate.setDate(scheduledDate.getDate() + (round - 1) * 3);

            fixtures.push({
              tournament: req.params.tournamentId,
              round: roundName,
              matchNumber: matchNumber++,
              homeTeam: currentRound[i]._id,
              awayTeam: currentRound[i + 1]._id,
              scheduledDate,
              venue: tournament.location
            });
          }
        }
        
        // For knockout, we'd need to handle progression after matches are played
        break; // For now, just create first round
      }
    }

    const createdFixtures = await Fixture.insertMany(fixtures);
    
    // Populate the created fixtures
    const populatedFixtures = await Fixture.find({ 
      tournament: req.params.tournamentId 
    }).populate([
      { path: 'homeTeam', select: 'name' },
      { path: 'awayTeam', select: 'name' }
    ]).sort({ matchNumber: 1 });

    res.status(201).json(populatedFixtures);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;