const Fixture = require('../models/Fixture');
const Tournament = require('../models/Tournament');
const Registration = require('../models/Registration');
const { validationResult } = require('express-validator');

// Generate fixtures for a tournament
const generateFixtures = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { fixtures, settings } = req.body;

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ 
        success: false, 
        message: 'Tournament not found' 
      });
    }

    // Check if user is authorized
    if (tournament.createdBy.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to manage this tournament' 
      });
    }

    // Get approved registrations
    const registrations = await Registration.find({ 
      tournament: tournamentId, 
      status: 'Approved' 
    });

    if (registrations.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least 2 approved registrations are required to generate fixtures'
      });
    }

    // Clear existing fixtures if any
    await Fixture.deleteMany({ tournament: tournamentId });

    // Create fixtures from the generated data
    const fixturePromises = fixtures.map(fixtureData => {
      const fixture = new Fixture({
        tournament: tournamentId,
        round: fixtureData.round,
        matchNumber: fixtureData.matchNumber,
        participant1: fixtureData.participant1._id,
        participant2: fixtureData.participant2._id,
        scheduledDate: fixtureData.scheduledDate,
        venue: fixtureData.venue,
        court: fixtureData.court,
        bracketPosition: fixtureData.bracketPosition,
        status: 'Scheduled'
      });
      return fixture.save();
    });

    const createdFixtures = await Promise.all(fixturePromises);

    // Update tournament status to InProgress if it was Draft
    if (tournament.status === 'Draft') {
      tournament.status = 'Open';
      await tournament.save();
    }

    // Populate the created fixtures
    const populatedFixtures = await Fixture.find({ 
      tournament: tournamentId 
    }).populate([
      { path: 'participant1', populate: { path: 'captain', select: 'firstName lastName' } },
      { path: 'participant2', populate: { path: 'captain', select: 'firstName lastName' } }
    ]).sort({ round: 1, matchNumber: 1 });

    res.status(201).json({
      success: true,
      data: populatedFixtures,
      message: `${createdFixtures.length} fixtures generated successfully`
    });
  } catch (error) {
    console.error('Generate fixtures error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate fixtures',
      error: error.message 
    });
  }
};

// Update fixture result
const updateFixtureResult = async (req, res) => {
  try {
    const { id } = req.params;
    const { result, status } = req.body;

    const fixture = await Fixture.findById(id)
      .populate('tournament')
      .populate('participant1 participant2');
    
    if (!fixture) {
      return res.status(404).json({ 
        success: false, 
        message: 'Fixture not found' 
      });
    }

    // Check if user is authorized
    if (fixture.tournament.createdBy.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to update this fixture' 
      });
    }

    // Update fixture with result
    fixture.result = result;
    fixture.status = status || 'Completed';

    // Determine winner based on result
    if (result && !result.forfeit) {
      if (result.participant1Score > result.participant2Score) {
        fixture.winner = fixture.participant1._id;
      } else if (result.participant2Score > result.participant1Score) {
        fixture.winner = fixture.participant2._id;
      }
      // If scores are equal, it's a draw (no winner set)
    } else if (result && result.forfeit) {
      // Handle forfeit - winner is determined by forfeit reason or manual selection
      // For now, assume the participant with higher score wins by forfeit
      fixture.winner = result.participant1Score > result.participant2Score 
        ? fixture.participant1._id 
        : fixture.participant2._id;
    }

    await fixture.save();

    // Handle bracket progression for elimination tournaments
    if (fixture.winner && (fixture.tournament.format.includes('Elimination') || fixture.tournament.format.includes('Knockout'))) {
      await progressWinnerToNextRound(fixture);
    }

    // Populate and return updated fixture
    const updatedFixture = await Fixture.findById(id)
      .populate([
        { path: 'tournament', select: 'name format' },
        { path: 'participant1', populate: { path: 'captain', select: 'firstName lastName' } },
        { path: 'participant2', populate: { path: 'captain', select: 'firstName lastName' } },
        { path: 'winner', populate: { path: 'captain', select: 'firstName lastName' } }
      ]);

    // Emit real-time match result update
    const io = req.app.get('io');
    if (io) {
      // Broadcast to tournament room
      io.to(`tournament_${fixture.tournament._id}`).emit('matchResult', {
        tournamentId: fixture.tournament._id.toString(),
        fixtureId: fixture._id.toString(),
        result: fixture.result,
        winner: fixture.winner?.toString(),
        status: fixture.status
      });

      // Broadcast bracket update to tournament room
      const allFixtures = await Fixture.find({ tournament: fixture.tournament._id })
        .populate([
          { path: 'participant1', populate: { path: 'captain', select: 'firstName lastName' } },
          { path: 'participant2', populate: { path: 'captain', select: 'firstName lastName' } },
          { path: 'winner', populate: { path: 'captain', select: 'firstName lastName' } }
        ])
        .sort({ round: 1, matchNumber: 1 });

      io.to(`tournament_${fixture.tournament._id}`).emit('bracketUpdate', {
        tournamentId: fixture.tournament._id.toString(),
        fixtures: allFixtures
      });
    }

    // Send notifications to participants
    const notificationService = req.app.get('notificationService');
    if (notificationService) {
      try {
        await notificationService.notifyMatchResult(fixture._id, fixture.result);
      } catch (notificationError) {
        console.error('Error sending match result notifications:', notificationError);
      }
    }

    res.json({
      success: true,
      data: updatedFixture,
      message: 'Match result updated successfully'
    });
  } catch (error) {
    console.error('Update fixture result error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update match result',
      error: error.message 
    });
  }
};

// Get fixtures for a tournament
const getTournamentFixtures = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { round, status } = req.query;

    const filter = { tournament: tournamentId };
    
    if (round) filter.round = parseInt(round);
    if (status) filter.status = status;

    const fixtures = await Fixture.find(filter)
      .populate([
        { path: 'participant1', populate: { path: 'captain', select: 'firstName lastName' } },
        { path: 'participant2', populate: { path: 'captain', select: 'firstName lastName' } },
        { path: 'winner', populate: { path: 'captain', select: 'firstName lastName' } }
      ])
      .sort({ round: 1, matchNumber: 1 });

    res.json({
      success: true,
      data: fixtures
    });
  } catch (error) {
    console.error('Get tournament fixtures error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get tournament fixtures',
      error: error.message 
    });
  }
};

// Update fixture status
const updateFixtureStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const fixture = await Fixture.findById(id).populate('tournament');
    
    if (!fixture) {
      return res.status(404).json({ 
        success: false, 
        message: 'Fixture not found' 
      });
    }

    // Check if user is authorized
    if (fixture.tournament.createdBy.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to update this fixture' 
      });
    }

    fixture.status = status;
    await fixture.save();

    const updatedFixture = await Fixture.findById(id)
      .populate([
        { path: 'participant1', populate: { path: 'captain', select: 'firstName lastName' } },
        { path: 'participant2', populate: { path: 'captain', select: 'firstName lastName' } }
      ]);

    res.json({
      success: true,
      data: updatedFixture,
      message: 'Fixture status updated successfully'
    });
  } catch (error) {
    console.error('Update fixture status error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update fixture status',
      error: error.message 
    });
  }
};

// Update fixture schedule
const updateFixtureSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledDate, venue } = req.body;

    const fixture = await Fixture.findById(id)
      .populate('tournament')
      .populate('participant1 participant2');
    
    if (!fixture) {
      return res.status(404).json({ 
        success: false, 
        message: 'Fixture not found' 
      });
    }

    // Check if user is authorized
    if (fixture.tournament.createdBy.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to update this fixture' 
      });
    }

    const originalDate = fixture.scheduledDate;
    const originalVenue = fixture.venue;

    // Update fixture schedule
    if (scheduledDate) fixture.scheduledDate = new Date(scheduledDate);
    if (venue !== undefined) fixture.venue = venue;

    await fixture.save();

    // Populate updated fixture
    const updatedFixture = await Fixture.findById(id)
      .populate([
        { path: 'tournament', select: 'name' },
        { path: 'participant1', populate: { path: 'captain', select: 'firstName lastName' } },
        { path: 'participant2', populate: { path: 'captain', select: 'firstName lastName' } }
      ]);

    // Emit real-time schedule update
    const io = req.app.get('io');
    if (io) {
      io.to(`tournament_${fixture.tournament._id}`).emit('scheduleUpdate', {
        tournamentId: fixture.tournament._id.toString(),
        fixtureId: fixture._id.toString(),
        scheduledDate: fixture.scheduledDate,
        venue: fixture.venue,
        originalDate,
        originalVenue
      });
    }

    // Send notifications to participants about schedule change
    const notificationService = req.app.get('notificationService');
    if (notificationService) {
      try {
        const changeMessage = [];
        if (scheduledDate && originalDate) {
          changeMessage.push(`Match time changed from ${new Date(originalDate).toLocaleString('en-AU')} to ${new Date(scheduledDate).toLocaleString('en-AU')}`);
        } else if (scheduledDate) {
          changeMessage.push(`Match scheduled for ${new Date(scheduledDate).toLocaleString('en-AU')}`);
        }
        
        if (venue && venue !== originalVenue) {
          changeMessage.push(`Venue ${originalVenue ? 'changed to' : 'set to'} ${venue}`);
        }

        if (changeMessage.length > 0) {
          await notificationService.notifyScheduleChange(fixture._id, {
            title: 'Match Schedule Updated',
            message: changeMessage.join('. '),
            priority: 'high',
            originalDate,
            newDate: scheduledDate,
            venue,
            createdBy: req.user._id
          });
        }
      } catch (notificationError) {
        console.error('Error sending schedule change notifications:', notificationError);
      }
    }

    res.json({
      success: true,
      data: updatedFixture,
      message: 'Match schedule updated successfully'
    });
  } catch (error) {
    console.error('Update fixture schedule error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update match schedule',
      error: error.message 
    });
  }
};

// Helper function to progress winner to next round
const progressWinnerToNextRound = async (completedFixture) => {
  try {
    const { tournament, winner, round, bracketPosition } = completedFixture;
    
    // Find the next round fixture that this winner should advance to
    const nextRound = round + 1;
    
    // This is a simplified progression logic
    // In a real implementation, you'd need more sophisticated bracket management
    const nextRoundFixtures = await Fixture.find({
      tournament: tournament._id,
      round: nextRound,
      $or: [
        { participant1: null },
        { participant2: null }
      ]
    }).sort({ matchNumber: 1 });

    if (nextRoundFixtures.length > 0) {
      const nextFixture = nextRoundFixtures[0];
      
      if (!nextFixture.participant1) {
        nextFixture.participant1 = winner;
      } else if (!nextFixture.participant2) {
        nextFixture.participant2 = winner;
      }
      
      await nextFixture.save();
    }
  } catch (error) {
    console.error('Error progressing winner to next round:', error);
  }
};

// Get bracket visualization data
const getBracketData = async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({ 
        success: false, 
        message: 'Tournament not found' 
      });
    }

    const fixtures = await Fixture.find({ tournament: tournamentId })
      .populate([
        { path: 'participant1', populate: { path: 'captain', select: 'firstName lastName' } },
        { path: 'participant2', populate: { path: 'captain', select: 'firstName lastName' } },
        { path: 'winner', populate: { path: 'captain', select: 'firstName lastName' } }
      ])
      .sort({ round: 1, matchNumber: 1 });

    // Group fixtures by round
    const bracketData = fixtures.reduce((acc, fixture) => {
      if (!acc[fixture.round]) {
        acc[fixture.round] = [];
      }
      acc[fixture.round].push(fixture);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        tournament,
        bracket: bracketData,
        totalRounds: Math.max(...fixtures.map(f => f.round), 0)
      }
    });
  } catch (error) {
    console.error('Get bracket data error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get bracket data',
      error: error.message 
    });
  }
};

module.exports = {
  generateFixtures,
  updateFixtureResult,
  getTournamentFixtures,
  updateFixtureStatus,
  updateFixtureSchedule,
  getBracketData
};