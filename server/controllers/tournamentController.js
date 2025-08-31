const Tournament = require('../models/Tournament');
const Registration = require('../models/Registration');
const Fixture = require('../models/Fixture');
const { validationResult } = require('express-validator');

// Create tournament
const createTournament = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const tournamentData = {
      ...req.body,
      createdBy: req.user._id,
      status: 'Draft'
    };

    const tournament = new Tournament(tournamentData);
    await tournament.save();
    
    await tournament.populate('createdBy', 'firstName lastName email');
    
    res.status(201).json({
      success: true,
      data: tournament,
      message: 'Tournament created successfully'
    });
  } catch (error) {
    console.error('Create tournament error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create tournament',
      error: error.message 
    });
  }
};

// Update tournament
const updateTournament = async (req, res) => {
  try {
    const { id } = req.params;
    
    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ 
        success: false, 
        message: 'Tournament not found' 
      });
    }

    // Check if user is the creator or admin
    if (tournament.createdBy.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to update this tournament' 
      });
    }

    // Prevent certain updates if tournament has started
    if (tournament.status === 'InProgress' || tournament.status === 'Completed') {
      const restrictedFields = ['format', 'maxParticipants', 'startDate', 'endDate'];
      const hasRestrictedUpdates = restrictedFields.some(field => req.body[field] !== undefined);
      
      if (hasRestrictedUpdates) {
        return res.status(400).json({
          success: false,
          message: 'Cannot modify tournament format or dates after tournament has started'
        });
      }
    }

    const updatedTournament = await Tournament.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName email');

    res.json({
      success: true,
      data: updatedTournament,
      message: 'Tournament updated successfully'
    });
  } catch (error) {
    console.error('Update tournament error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update tournament',
      error: error.message 
    });
  }
};

// Get tournament standings
const getTournamentStandings = async (req, res) => {
  try {
    const { id } = req.params;
    
    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ 
        success: false, 
        message: 'Tournament not found' 
      });
    }

    // Get all registrations for the tournament
    const registrations = await Registration.find({ 
      tournament: id, 
      status: 'Approved' 
    }).populate('captain teamMembers', 'firstName lastName email');

    // Get all fixtures for the tournament
    const fixtures = await Fixture.find({ tournament: id })
      .populate('participant1 participant2 winner');

    // Calculate standings based on tournament format
    let standings = [];

    if (tournament.format === 'Round Robin') {
      standings = calculateRoundRobinStandings(registrations, fixtures);
    } else {
      standings = calculateEliminationStandings(registrations, fixtures);
    }

    res.json({
      success: true,
      data: standings
    });
  } catch (error) {
    console.error('Get standings error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get tournament standings',
      error: error.message 
    });
  }
};

// Calculate final standings and update tournament status
const calculateFinalStandings = async (req, res) => {
  try {
    const { id } = req.params;
    
    const tournament = await Tournament.findById(id);
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

    // Check if all matches are completed
    const incompleteMatches = await Fixture.countDocuments({
      tournament: id,
      status: { $ne: 'Completed' }
    });

    if (incompleteMatches > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot finalize tournament. ${incompleteMatches} matches are still incomplete.`
      });
    }

    // Update tournament status to completed
    tournament.status = 'Completed';
    await tournament.save();

    // Calculate and return final standings
    const standingsResponse = await getTournamentStandings(req, res);
    
    res.json({
      success: true,
      message: 'Tournament completed and final standings calculated',
      data: standingsResponse.data
    });
  } catch (error) {
    console.error('Calculate final standings error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to calculate final standings',
      error: error.message 
    });
  }
};

// Distribute prizes
const distributePrizes = async (req, res) => {
  try {
    const { id } = req.params;
    const { standings, bankDetails } = req.body;
    
    const tournament = await Tournament.findById(id);
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

    if (tournament.status !== 'Completed') {
      return res.status(400).json({
        success: false,
        message: 'Tournament must be completed before distributing prizes'
      });
    }

    // Here you would integrate with payment processing
    // For now, we'll just log the prize distribution
    console.log('Prize distribution initiated for tournament:', tournament.name);
    console.log('Winners:', standings);
    
    // In a real implementation, you would:
    // 1. Send notifications to winners
    // 2. Collect bank details from winners
    // 3. Process payments through banking API
    // 4. Update prize distribution status

    res.json({
      success: true,
      message: 'Prize distribution initiated successfully',
      data: {
        tournamentId: id,
        winners: standings.length,
        totalPrizeAmount: tournament.prizePool.first + (tournament.prizePool.second || 0) + (tournament.prizePool.third || 0)
      }
    });
  } catch (error) {
    console.error('Distribute prizes error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to distribute prizes',
      error: error.message 
    });
  }
};

// Helper function to calculate round robin standings
const calculateRoundRobinStandings = (registrations, fixtures) => {
  const standings = registrations.map(registration => ({
    participant: registration,
    position: 0,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    points: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    winPercentage: 0
  }));

  // Calculate stats from fixtures
  fixtures.forEach(fixture => {
    if (fixture.status === 'Completed' && fixture.result) {
      const participant1Index = standings.findIndex(s => 
        s.participant._id.toString() === fixture.participant1._id.toString()
      );
      const participant2Index = standings.findIndex(s => 
        s.participant._id.toString() === fixture.participant2._id.toString()
      );

      if (participant1Index !== -1 && participant2Index !== -1) {
        const p1Standing = standings[participant1Index];
        const p2Standing = standings[participant2Index];

        // Update matches played
        p1Standing.matchesPlayed++;
        p2Standing.matchesPlayed++;

        // Update goals
        p1Standing.goalsFor += fixture.result.participant1Score;
        p1Standing.goalsAgainst += fixture.result.participant2Score;
        p2Standing.goalsFor += fixture.result.participant2Score;
        p2Standing.goalsAgainst += fixture.result.participant1Score;

        // Update wins/losses/draws and points
        if (fixture.result.participant1Score > fixture.result.participant2Score) {
          p1Standing.wins++;
          p1Standing.points += 3;
          p2Standing.losses++;
        } else if (fixture.result.participant2Score > fixture.result.participant1Score) {
          p2Standing.wins++;
          p2Standing.points += 3;
          p1Standing.losses++;
        } else {
          p1Standing.draws++;
          p2Standing.draws++;
          p1Standing.points += 1;
          p2Standing.points += 1;
        }
      }
    }
  });

  // Calculate goal difference and win percentage
  standings.forEach(standing => {
    standing.goalDifference = standing.goalsFor - standing.goalsAgainst;
    standing.winPercentage = standing.matchesPlayed > 0 
      ? (standing.wins / standing.matchesPlayed) * 100 
      : 0;
  });

  // Sort standings (points, then goal difference, then goals for)
  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    return b.goalsFor - a.goalsFor;
  });

  // Assign positions
  standings.forEach((standing, index) => {
    standing.position = index + 1;
  });

  return standings;
};

// Helper function to calculate elimination tournament standings
const calculateEliminationStandings = (registrations, fixtures) => {
  const standings = registrations.map(registration => ({
    participant: registration,
    position: 0,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    points: 0,
    winPercentage: 0,
    eliminated: false,
    advancedToNextRound: false
  }));

  // Calculate basic stats
  fixtures.forEach(fixture => {
    if (fixture.status === 'Completed' && fixture.result) {
      const participant1Index = standings.findIndex(s => 
        s.participant._id.toString() === fixture.participant1._id.toString()
      );
      const participant2Index = standings.findIndex(s => 
        s.participant._id.toString() === fixture.participant2._id.toString()
      );

      if (participant1Index !== -1 && participant2Index !== -1) {
        const p1Standing = standings[participant1Index];
        const p2Standing = standings[participant2Index];

        p1Standing.matchesPlayed++;
        p2Standing.matchesPlayed++;

        if (fixture.winner) {
          if (fixture.winner._id.toString() === fixture.participant1._id.toString()) {
            p1Standing.wins++;
            p2Standing.losses++;
            p2Standing.eliminated = true;
          } else {
            p2Standing.wins++;
            p1Standing.losses++;
            p1Standing.eliminated = true;
          }
        }
      }
    }
  });

  // Calculate win percentage
  standings.forEach(standing => {
    standing.winPercentage = standing.matchesPlayed > 0 
      ? (standing.wins / standing.matchesPlayed) * 100 
      : 0;
  });

  // Sort by wins, then by matches played (deeper run in tournament)
  standings.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.matchesPlayed - a.matchesPlayed;
  });

  // Assign positions
  standings.forEach((standing, index) => {
    standing.position = index + 1;
  });

  return standings;
};

module.exports = {
  createTournament,
  updateTournament,
  getTournamentStandings,
  calculateFinalStandings,
  distributePrizes
};