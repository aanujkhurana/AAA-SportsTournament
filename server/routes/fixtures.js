const express = require('express');
const { body, validationResult } = require('express-validator');
const Fixture = require('../models/Fixture');
const Tournament = require('../models/Tournament');
const Team = require('../models/Team');
const { auth, adminAuth } = require('../middleware/auth');
const {
  generateFixtures,
  updateFixtureResult,
  getTournamentFixtures,
  updateFixtureStatus,
  updateFixtureSchedule,
  getBracketData
} = require('../controllers/fixtureController');

const router = express.Router();

// Get fixtures for a tournament
router.get('/tournament/:tournamentId', getTournamentFixtures);

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

// Update fixture result (admin only)
router.put('/:id/result', adminAuth, [
  body('result.participant1Score').isInt({ min: 0 }).withMessage('Valid participant 1 score required'),
  body('result.participant2Score').isInt({ min: 0 }).withMessage('Valid participant 2 score required'),
  body('result.completedAt').optional().isISO8601(),
  body('result.notes').optional().isString(),
  body('result.forfeit').optional().isBoolean(),
  body('result.overtime').optional().isBoolean()
], updateFixtureResult);

// Update fixture status (admin only)
router.put('/:id/status', adminAuth, [
  body('status').isIn(['Scheduled', 'InProgress', 'Completed', 'Cancelled', 'Postponed'])
    .withMessage('Valid status required')
], updateFixtureStatus);

// Update fixture schedule (admin only)
router.put('/:id/schedule', adminAuth, [
  body('scheduledDate').optional().isISO8601().withMessage('Valid date required'),
  body('venue').optional().isString().withMessage('Valid venue required')
], updateFixtureSchedule);

// Update fixture details (admin only)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const fixture = await Fixture.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate([
      { path: 'tournament', select: 'name sport' },
      { path: 'participant1', populate: { path: 'captain', select: 'firstName lastName' } },
      { path: 'participant2', populate: { path: 'captain', select: 'firstName lastName' } },
      { path: 'winner', populate: { path: 'captain', select: 'firstName lastName' } }
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
router.post('/generate/:tournamentId', adminAuth, generateFixtures);

// Get bracket visualization data
router.get('/bracket/:tournamentId', getBracketData);

module.exports = router;