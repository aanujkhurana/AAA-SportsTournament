const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { auth } = require('../middleware/auth');
const Notification = require('../models/Notification');
const router = express.Router();

// Get user notifications with filtering and pagination
router.get('/', auth, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('type').optional().isIn(['tournament', 'payment', 'schedule', 'team', 'system', 'weather', 'venue', 'announcement']),
  query('isRead').optional().isBoolean(),
  query('priority').optional().isIn(['low', 'medium', 'high', 'urgent'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: errors.array()
        }
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build filter query
    const filter = { recipient: req.user.id };
    
    if (req.query.type) filter.type = req.query.type;
    if (req.query.isRead !== undefined) filter.isRead = req.query.isRead === 'true';
    if (req.query.priority) filter.priority = req.query.priority;

    // Get notifications with pagination
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('relatedId', 'name title')
      .lean();

    // Get total count for pagination
    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.countDocuments({ 
      recipient: req.user.id, 
      isRead: false 
    });

    // Add timeAgo to each notification
    const notificationsWithTimeAgo = notifications.map(notification => ({
      ...notification,
      timeAgo: getTimeAgo(notification.createdAt)
    }));

    res.json({
      success: true,
      data: {
        notifications: notificationsWithTimeAgo,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        unreadCount
      }
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch notifications',
        code: 'FETCH_NOTIFICATIONS_ERROR'
      }
    });
  }
});

// Mark notification as read
router.patch('/:id/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: req.user.id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Notification not found',
          code: 'NOTIFICATION_NOT_FOUND'
        }
      });
    }

    notification.isRead = true;
    await notification.save();

    // Emit real-time update
    if (req.app.get('io')) {
      req.app.get('io').to(`user_${req.user.id}`).emit('notificationRead', {
        notificationId: notification._id
      });
    }

    res.json({
      success: true,
      data: { notification }
    });

  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to mark notification as read',
        code: 'MARK_READ_ERROR'
      }
    });
  }
});

// Mark all notifications as read
router.patch('/mark-all-read', auth, async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user.id, isRead: false },
      { isRead: true }
    );

    // Emit real-time update
    if (req.app.get('io')) {
      req.app.get('io').to(`user_${req.user.id}`).emit('allNotificationsRead');
    }

    res.json({
      success: true,
      data: { 
        message: `${result.modifiedCount} notifications marked as read`
      }
    });

  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to mark all notifications as read',
        code: 'MARK_ALL_READ_ERROR'
      }
    });
  }
});

// Delete notification
router.delete('/:id', auth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user.id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Notification not found',
          code: 'NOTIFICATION_NOT_FOUND'
        }
      });
    }

    // Emit real-time update
    if (req.app.get('io')) {
      req.app.get('io').to(`user_${req.user.id}`).emit('notificationDeleted', {
        notificationId: notification._id
      });
    }

    res.json({
      success: true,
      data: { message: 'Notification deleted successfully' }
    });

  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete notification',
        code: 'DELETE_NOTIFICATION_ERROR'
      }
    });
  }
});

// Admin: Create tournament announcement
router.post('/tournament/:tournamentId/announcement', auth, [
  body('title').notEmpty().isLength({ max: 200 }).withMessage('Title is required and must be under 200 characters'),
  body('message').notEmpty().isLength({ max: 1000 }).withMessage('Message is required and must be under 1000 characters'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority level'),
  body('sendEmail').optional().isBoolean().withMessage('Send email must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: errors.array()
        }
      });
    }

    const { title, message, priority = 'medium', sendEmail = false } = req.body;
    const tournamentId = req.params.tournamentId;

    // Verify user has permission to send announcements for this tournament
    const Tournament = require('../models/Tournament');
    const tournament = await Tournament.findById(tournamentId);
    
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Tournament not found',
          code: 'TOURNAMENT_NOT_FOUND'
        }
      });
    }

    // Check if user is admin or tournament creator
    if (!req.user.isAdmin && tournament.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Not authorized to send announcements for this tournament',
          code: 'UNAUTHORIZED'
        }
      });
    }

    // Broadcast announcement to all tournament participants
    const notifications = await Notification.broadcastTournamentUpdate(
      tournamentId,
      {
        type: 'announcement',
        title,
        message,
        priority,
        actionUrl: `/tournaments/${tournamentId}`,
        actionText: 'View Tournament',
        metadata: {
          tournamentName: tournament.name
        },
        createdBy: req.user.id
      },
      req.app.get('io')
    );

    // Send emails if requested
    if (sendEmail && notifications.length > 0) {
      const emailService = require('../services/emailService');
      const Registration = require('../models/Registration');
      
      const registrations = await Registration.find({ 
        tournament: tournamentId,
        status: 'Approved'
      }).populate('captain', 'firstName lastName email');

      const users = registrations.map(reg => reg.captain);
      
      await emailService.sendTournamentAnnouncementEmail(
        users, 
        tournament, 
        title, 
        message
      );
    }

    res.json({
      success: true,
      data: {
        message: `Announcement sent to ${notifications.length} participants`,
        notificationCount: notifications.length
      }
    });

  } catch (error) {
    console.error('Error sending tournament announcement:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to send tournament announcement',
        code: 'SEND_ANNOUNCEMENT_ERROR'
      }
    });
  }
});

// Admin: Send weather/venue update
router.post('/tournament/:tournamentId/weather-venue-update', auth, [
  body('type').isIn(['weather', 'venue']).withMessage('Type must be weather or venue'),
  body('title').notEmpty().isLength({ max: 200 }).withMessage('Title is required'),
  body('message').notEmpty().isLength({ max: 1000 }).withMessage('Message is required'),
  body('newVenue').optional().isString().withMessage('New venue must be a string'),
  body('weatherCondition').optional().isString().withMessage('Weather condition must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: errors.array()
        }
      });
    }

    const { type, title, message, newVenue, weatherCondition } = req.body;
    const tournamentId = req.params.tournamentId;

    // Verify tournament and permissions
    const Tournament = require('../models/Tournament');
    const tournament = await Tournament.findById(tournamentId);
    
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Tournament not found',
          code: 'TOURNAMENT_NOT_FOUND'
        }
      });
    }

    if (!req.user.isAdmin && tournament.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Not authorized to send updates for this tournament',
          code: 'UNAUTHORIZED'
        }
      });
    }

    // Update tournament venue if provided
    if (type === 'venue' && newVenue) {
      tournament.venue = newVenue;
      await tournament.save();
    }

    // Broadcast update to all participants
    const notifications = await Notification.broadcastTournamentUpdate(
      tournamentId,
      {
        type,
        title,
        message,
        priority: 'urgent', // Weather/venue changes are always urgent
        actionUrl: `/tournaments/${tournamentId}`,
        actionText: 'View Details',
        metadata: {
          tournamentName: tournament.name,
          venue: newVenue || tournament.venue,
          weather: weatherCondition
        },
        createdBy: req.user.id
      },
      req.app.get('io')
    );

    // Send urgent emails for weather/venue changes
    const emailService = require('../services/emailService');
    const Registration = require('../models/Registration');
    
    const registrations = await Registration.find({ 
      tournament: tournamentId,
      status: 'Approved'
    }).populate('captain', 'firstName lastName email');

    const users = registrations.map(reg => reg.captain);
    
    await emailService.sendWeatherVenueUpdateEmail(
      users, 
      tournament, 
      type,
      title,
      message,
      { newVenue, weatherCondition }
    );

    res.json({
      success: true,
      data: {
        message: `${type} update sent to ${notifications.length} participants`,
        notificationCount: notifications.length
      }
    });

  } catch (error) {
    console.error('Error sending weather/venue update:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to send weather/venue update',
        code: 'SEND_UPDATE_ERROR'
      }
    });
  }
});

// Helper function to calculate time ago
function getTimeAgo(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  
  return date.toLocaleDateString('en-AU');
}

module.exports = router;