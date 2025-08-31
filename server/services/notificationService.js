const Notification = require('../models/Notification');
const emailService = require('./emailService');

class NotificationService {
  constructor(io = null) {
    this.io = io;
  }

  setSocketIO(io) {
    this.io = io;
  }

  // Create a single notification
  async createNotification(notificationData) {
    try {
      return await Notification.createAndBroadcast(notificationData, this.io);
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Notify about payment status changes
  async notifyPaymentStatusChange(registrationId, status, verificationNotes = null) {
    try {
      const Registration = require('../models/Registration');
      const Tournament = require('../models/Tournament');
      
      const registration = await Registration.findById(registrationId)
        .populate('captain', 'firstName lastName email')
        .populate('tournament', 'name');

      if (!registration) {
        throw new Error('Registration not found');
      }

      const isApproved = status === 'Confirmed';
      const title = isApproved ? 'Payment Confirmed ✅' : 'Payment Issue ❌';
      const message = isApproved 
        ? `Your payment for ${registration.tournament.name} has been verified and approved!`
        : `There was an issue with your payment for ${registration.tournament.name}. Please contact the organizer.`;

      const notificationData = {
        recipient: registration.captain._id,
        type: 'payment',
        title,
        message,
        priority: isApproved ? 'medium' : 'high',
        actionUrl: isApproved ? `/tournaments/${registration.tournament._id}` : '/dashboard?tab=payments',
        actionText: isApproved ? 'View Tournament' : 'Check Payment',
        relatedId: registrationId,
        relatedModel: 'Registration',
        metadata: {
          tournamentName: registration.tournament.name,
          amount: registration.tournament.entryFee
        }
      };

      const notification = await this.createNotification(notificationData);

      // Send email notification
      await emailService.sendPaymentVerificationEmail(
        registration.captain,
        registration.tournament,
        registration,
        isApproved,
        verificationNotes
      );

      return notification;
    } catch (error) {
      console.error('Error notifying payment status change:', error);
      throw error;
    }
  }

  // Notify about match result updates
  async notifyMatchResult(fixtureId, result) {
    try {
      const Fixture = require('../models/Fixture');
      const Registration = require('../models/Registration');
      
      const fixture = await Fixture.findById(fixtureId)
        .populate('tournament', 'name')
        .populate('participant1 participant2');

      if (!fixture) {
        throw new Error('Fixture not found');
      }

      const participants = [fixture.participant1, fixture.participant2].filter(Boolean);
      const notifications = [];

      for (const participant of participants) {
        const registration = await Registration.findById(participant._id).populate('captain');
        const isWinner = fixture.winner && fixture.winner.toString() === participant._id.toString();
        
        const title = isWinner ? 'Match Won! 🏆' : 'Match Result Posted';
        const message = isWinner 
          ? `Congratulations! You won your match in ${fixture.tournament.name}.`
          : `Your match result has been posted for ${fixture.tournament.name}.`;

        const notificationData = {
          recipient: registration.captain._id,
          type: 'tournament',
          title,
          message,
          priority: 'medium',
          actionUrl: `/tournaments/${fixture.tournament._id}`,
          actionText: 'View Tournament',
          relatedId: fixtureId,
          relatedModel: 'Fixture',
          metadata: {
            tournamentName: fixture.tournament.name,
            matchDate: fixture.scheduledDate
          }
        };

        const notification = await this.createNotification(notificationData);
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      console.error('Error notifying match result:', error);
      throw error;
    }
  }

  // Notify about tournament bracket updates
  async notifyBracketUpdate(tournamentId, updateMessage) {
    try {
      const Tournament = require('../models/Tournament');
      const tournament = await Tournament.findById(tournamentId);

      if (!tournament) {
        throw new Error('Tournament not found');
      }

      const notifications = await Notification.broadcastTournamentUpdate(
        tournamentId,
        {
          type: 'tournament',
          title: 'Tournament Bracket Updated',
          message: updateMessage || `The tournament bracket for ${tournament.name} has been updated.`,
          priority: 'medium',
          actionUrl: `/tournaments/${tournamentId}`,
          actionText: 'View Bracket',
          metadata: {
            tournamentName: tournament.name
          }
        },
        this.io
      );

      return notifications;
    } catch (error) {
      console.error('Error notifying bracket update:', error);
      throw error;
    }
  }

  // Notify about schedule changes
  async notifyScheduleChange(fixtureId, changeData) {
    try {
      return await Notification.notifyScheduleChange(fixtureId, changeData, this.io);
    } catch (error) {
      console.error('Error notifying schedule change:', error);
      throw error;
    }
  }

  // Notify about tournament registration confirmation
  async notifyRegistrationConfirmation(registrationId) {
    try {
      const Registration = require('../models/Registration');
      const registration = await Registration.findById(registrationId)
        .populate('captain', 'firstName lastName email')
        .populate('tournament', 'name startDate venue address');

      if (!registration) {
        throw new Error('Registration not found');
      }

      const notificationData = {
        recipient: registration.captain._id,
        type: 'tournament',
        title: 'Registration Confirmed! 🎉',
        message: `Your registration for ${registration.tournament.name} has been confirmed. Get ready to compete!`,
        priority: 'medium',
        actionUrl: `/tournaments/${registration.tournament._id}`,
        actionText: 'View Tournament',
        relatedId: registrationId,
        relatedModel: 'Registration',
        metadata: {
          tournamentName: registration.tournament.name,
          matchDate: registration.tournament.startDate
        }
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      console.error('Error notifying registration confirmation:', error);
      throw error;
    }
  }

  // Notify about upcoming tournaments (24 hours before)
  async notifyUpcomingTournaments() {
    try {
      const Tournament = require('../models/Tournament');
      const Registration = require('../models/Registration');
      
      // Find tournaments starting in 24 hours
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

      const upcomingTournaments = await Tournament.find({
        startDate: {
          $gte: tomorrow,
          $lt: dayAfterTomorrow
        },
        status: { $in: ['Open', 'Full', 'InProgress'] }
      });

      const notifications = [];

      for (const tournament of upcomingTournaments) {
        const registrations = await Registration.find({
          tournament: tournament._id,
          status: 'Approved'
        }).populate('captain', 'firstName lastName email');

        for (const registration of registrations) {
          const notificationData = {
            recipient: registration.captain._id,
            type: 'tournament',
            title: 'Tournament Starting Tomorrow! 🏆',
            message: `${tournament.name} starts tomorrow at ${tournament.venue}. Make sure you're ready!`,
            priority: 'high',
            actionUrl: `/tournaments/${tournament._id}`,
            actionText: 'View Details',
            relatedId: tournament._id,
            relatedModel: 'Tournament',
            metadata: {
              tournamentName: tournament.name,
              matchDate: tournament.startDate,
              venue: tournament.venue
            }
          };

          const notification = await this.createNotification(notificationData);
          notifications.push(notification);
        }
      }

      return notifications;
    } catch (error) {
      console.error('Error notifying upcoming tournaments:', error);
      throw error;
    }
  }

  // Notify about team member additions
  async notifyTeamMemberAdded(registrationId, newMemberId) {
    try {
      const Registration = require('../models/Registration');
      const User = require('../models/User');
      
      const registration = await Registration.findById(registrationId)
        .populate('captain', 'firstName lastName email')
        .populate('tournament', 'name');

      const newMember = await User.findById(newMemberId);

      if (!registration || !newMember) {
        throw new Error('Registration or new member not found');
      }

      // Notify team captain
      const captainNotificationData = {
        recipient: registration.captain._id,
        type: 'team',
        title: 'Team Member Added',
        message: `${newMember.firstName} ${newMember.lastName} has joined your team for ${registration.tournament.name}.`,
        priority: 'low',
        actionUrl: `/tournaments/${registration.tournament._id}`,
        actionText: 'View Team',
        relatedId: registrationId,
        relatedModel: 'Registration',
        metadata: {
          tournamentName: registration.tournament.name,
          teamName: registration.teamName
        }
      };

      // Notify new team member
      const memberNotificationData = {
        recipient: newMemberId,
        type: 'team',
        title: 'Added to Team',
        message: `You've been added to team "${registration.teamName}" for ${registration.tournament.name}.`,
        priority: 'medium',
        actionUrl: `/tournaments/${registration.tournament._id}`,
        actionText: 'View Tournament',
        relatedId: registrationId,
        relatedModel: 'Registration',
        metadata: {
          tournamentName: registration.tournament.name,
          teamName: registration.teamName
        }
      };

      const notifications = await Promise.all([
        this.createNotification(captainNotificationData),
        this.createNotification(memberNotificationData)
      ]);

      return notifications;
    } catch (error) {
      console.error('Error notifying team member addition:', error);
      throw error;
    }
  }

  // Clean up old notifications (older than 30 days)
  async cleanupOldNotifications() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await Notification.deleteMany({
        createdAt: { $lt: thirtyDaysAgo },
        isRead: true
      });

      console.log(`Cleaned up ${result.deletedCount} old notifications`);
      return result.deletedCount;
    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;