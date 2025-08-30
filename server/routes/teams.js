const express = require('express');
const { body, validationResult } = require('express-validator');
const Team = require('../models/Team');
const Tournament = require('../models/Tournament');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// Register team for tournament
router.post('/register', [
  body('name').notEmpty().trim(),
  body('tournament').isMongoId(),
  body('captain.name').notEmpty().trim(),
  body('captain.email').isEmail().normalizeEmail(),
  body('captain.phone').notEmpty().trim(),
  body('players').isArray({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { tournament: tournamentId } = req.body;

    // Check if tournament exists and registration is open
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    if (tournament.status !== 'registration-open') {
      return res.status(400).json({ message: 'Registration is not open for this tournament' });
    }

    if (new Date() > tournament.registrationDeadline) {
      return res.status(400).json({ message: 'Registration deadline has passed' });
    }

    // Check if team name already exists in tournament
    const existingTeam = await Team.findOne({ 
      name: req.body.name, 
      tournament: tournamentId 
    });
    if (existingTeam) {
      return res.status(400).json({ message: 'Team name already exists in this tournament' });
    }

    // Check max teams limit
    const teamCount = await Team.countDocuments({ tournament: tournamentId });
    if (teamCount >= tournament.maxTeams) {
      return res.status(400).json({ message: 'Tournament is full' });
    }

    const team = new Team(req.body);
    await team.save();
    await team.populate('tournament', 'name sport');

    res.status(201).json(team);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get teams for a tournament
router.get('/tournament/:tournamentId', async (req, res) => {
  try {
    const teams = await Team.find({ tournament: req.params.tournamentId })
      .populate('tournament', 'name sport')
      .sort({ registrationDate: 1 });
    
    res.json(teams);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get team by ID
router.get('/:id', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('tournament', 'name sport format');
    
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    res.json(team);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update team status (admin only)
router.put('/:id/status', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['registered', 'confirmed', 'withdrawn'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const team = await Team.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('tournament', 'name sport');

    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    res.json(team);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete team (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const team = await Team.findByIdAndDelete(req.params.id);
    
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;