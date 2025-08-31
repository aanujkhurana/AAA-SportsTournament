const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Registration = require('../models/Registration');
const Tournament = require('../models/Tournament');
const { auth } = require('../middleware/auth');

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      state,
      preferredSports,
      skillLevel,
      dateOfBirth,
      emergencyContact
    } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update fields if provided
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;
    if (state !== undefined) user.state = state;
    if (preferredSports !== undefined) user.preferredSports = preferredSports;
    if (skillLevel !== undefined) user.skillLevel = skillLevel;
    if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth;
    if (emergencyContact !== undefined) user.emergencyContact = emergencyContact;

    await user.save();

    // Return updated user without password
    const updatedUser = await User.findById(req.user.id).select('-password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get dashboard statistics
router.get('/dashboard/stats', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's registrations
    const registrations = await Registration.find({ captain: userId })
      .populate('tournament', 'startDate endDate status')
      .lean();

    // Calculate statistics
    const completedTournaments = registrations.filter(reg => {
      const tournament = reg.tournament;
      return tournament && new Date(tournament.endDate) < new Date() && tournament.status === 'Completed';
    });

    const upcomingTournaments = registrations.filter(reg => {
      const tournament = reg.tournament;
      return tournament && new Date(tournament.startDate) > new Date() && reg.status === 'Approved';
    });

    const pendingPayments = registrations.filter(reg => 
      reg.paymentStatus === 'Pending' && reg.status !== 'Rejected'
    );

    // Mock match statistics - in real app this would come from fixtures/results
    const mockMatchStats = {
      totalMatches: completedTournaments.length * 3, // Assume 3 matches per tournament on average
      wins: Math.floor(completedTournaments.length * 2), // Mock win count
      losses: Math.floor(completedTournaments.length * 1), // Mock loss count
    };

    const winRate = mockMatchStats.totalMatches > 0 
      ? Math.round((mockMatchStats.wins / mockMatchStats.totalMatches) * 100)
      : 0;

    const stats = {
      tournamentsPlayed: completedTournaments.length,
      totalRegistrations: registrations.length,
      upcomingTournaments: upcomingTournaments.length,
      pendingPayments: pendingPayments.length,
      wins: mockMatchStats.wins,
      losses: mockMatchStats.losses,
      winRate,
      unreadNotifications: 3, // Mock - would come from notifications system
      upcomingMatches: upcomingTournaments.length * 2 // Mock - assume 2 matches per upcoming tournament
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get user's tournament history with results
router.get('/tournament-history', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get completed registrations with tournament details
    const registrations = await Registration.find({ 
      captain: userId,
      status: 'Approved'
    })
    .populate({
      path: 'tournament',
      select: 'name sport venue address startDate endDate prizePool status'
    })
    .populate({
      path: 'teamMembers',
      select: 'firstName lastName email'
    })
    .sort({ 'tournament.endDate': -1 })
    .lean();

    // Filter completed tournaments and add mock results
    const completedHistory = registrations
      .filter(reg => {
        const tournament = reg.tournament;
        return tournament && new Date(tournament.endDate) < new Date();
      })
      .map((reg, index) => ({
        ...reg,
        // Mock results for demonstration - in real app this would come from fixtures/results
        result: {
          position: Math.floor(Math.random() * 8) + 1,
          totalParticipants: Math.floor(Math.random() * 20) + 10,
          prizeWon: index % 3 === 0 ? reg.tournament.prizePool.first * 0.1 : 0,
          matchesPlayed: Math.floor(Math.random() * 5) + 3,
          matchesWon: Math.floor(Math.random() * 4) + 1,
          matchesLost: Math.floor(Math.random() * 3) + 1,
        }
      }));

    res.json({
      success: true,
      history: completedHistory
    });
  } catch (error) {
    console.error('Get tournament history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Search users (for team formation)
router.get('/search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({
        success: true,
        users: []
      });
    }

    const users = await User.find({
      $and: [
        { _id: { $ne: req.user.id } }, // Exclude current user
        {
          $or: [
            { firstName: { $regex: q, $options: 'i' } },
            { lastName: { $regex: q, $options: 'i' } },
            { email: { $regex: q, $options: 'i' } }
          ]
        }
      ]
    })
    .select('firstName lastName email preferredSports skillLevel state')
    .limit(10)
    .lean();

    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;