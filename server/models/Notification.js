const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['tournament', 'payment', 'schedule', 'team', 'system', 'weather', 'venue', 'announcement'],
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  actionUrl: {
    type: String,
    maxlength: 500
  },
  actionText: {
    type: String,
    maxlength: 50
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'relatedModel'
  },
  relatedModel: {
    type: String,
    enum: ['Tournament', 'Registration', 'Payment', 'Fixture', 'Team']
  },
  metadata: {
    tournamentName: String,
    amount: Number,
    matchDate: Date,
    teamName: String,
    venue: String,
    weather: String,
    originalDate: Date,
    newDate: Date
  },
  emailSent: {
    type: Boolean,
    default: false
  },
  emailSentAt: Date,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ relatedId: 1, relatedModel: 1 });

// Virtual for time ago
notificationSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - this.createdAt.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  
  return this.createdAt.toLocaleDateString('en-AU');
});

// Static method to create and broadcast notification
notificationSchema.statics.createAndBroadcast = async function(notificationData, io) {
  const notification = new this(notificationData);
  await notification.save();
  
  // Populate recipient for real-time broadcast
  await notification.populate('recipient', 'firstName lastName email');
  
  // Broadcast to specific user via WebSocket
  if (io && notification.recipient._id) {
    io.to(`user_${notification.recipient._id}`).emit('newNotification', {
      _id: notification._id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      priority: notification.priority,
      isRead: notification.isRead,
      actionUrl: notification.actionUrl,
      actionText: notification.actionText,
      metadata: notification.metadata,
      createdAt: notification.createdAt,
      timeAgo: notification.timeAgo
    });
  }
  
  return notification;
};

// Static method to broadcast tournament updates to all participants
notificationSchema.statics.broadcastTournamentUpdate = async function(tournamentId, updateData, io) {
  const Tournament = mongoose.model('Tournament');
  const Registration = mongoose.model('Registration');
  
  // Get all registered users for this tournament
  const registrations = await Registration.find({ 
    tournament: tournamentId,
    status: 'Approved'
  }).populate('captain', '_id firstName lastName email');
  
  const notifications = [];
  
  for (const registration of registrations) {
    const notificationData = {
      recipient: registration.captain._id,
      type: updateData.type || 'tournament',
      title: updateData.title,
      message: updateData.message,
      priority: updateData.priority || 'medium',
      actionUrl: updateData.actionUrl || `/tournaments/${tournamentId}`,
      actionText: updateData.actionText || 'View Tournament',
      relatedId: tournamentId,
      relatedModel: 'Tournament',
      metadata: updateData.metadata || {},
      createdBy: updateData.createdBy
    };
    
    const notification = await this.createAndBroadcast(notificationData, io);
    notifications.push(notification);
  }
  
  return notifications;
};

// Static method to notify about match schedule changes
notificationSchema.statics.notifyScheduleChange = async function(fixtureId, changeData, io) {
  const Fixture = mongoose.model('Fixture');
  const Registration = mongoose.model('Registration');
  
  const fixture = await Fixture.findById(fixtureId)
    .populate('tournament', 'name')
    .populate('participant1 participant2');
  
  if (!fixture) return [];
  
  const participants = [fixture.participant1, fixture.participant2].filter(Boolean);
  const notifications = [];
  
  for (const participant of participants) {
    const registration = await Registration.findById(participant._id).populate('captain');
    
    const notificationData = {
      recipient: registration.captain._id,
      type: 'schedule',
      title: changeData.title || 'Match Schedule Updated',
      message: changeData.message,
      priority: changeData.priority || 'high',
      actionUrl: `/dashboard?tab=schedule`,
      actionText: 'View Schedule',
      relatedId: fixtureId,
      relatedModel: 'Fixture',
      metadata: {
        tournamentName: fixture.tournament.name,
        matchDate: changeData.newDate || fixture.scheduledDate,
        originalDate: changeData.originalDate,
        newDate: changeData.newDate,
        venue: changeData.venue || fixture.venue
      },
      createdBy: changeData.createdBy
    };
    
    const notification = await this.createAndBroadcast(notificationData, io);
    notifications.push(notification);
  }
  
  return notifications;
};

module.exports = mongoose.model('Notification', notificationSchema);