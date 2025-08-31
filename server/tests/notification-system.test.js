const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../index');
const User = require('../models/User');
const Tournament = require('../models/Tournament');
const Registration = require('../models/Registration');
const Notification = require('../models/Notification');
const NotificationService = require('../services/notificationService');

describe('Notification System', () => {
  let adminToken, userToken, tournament, registration, notificationService;
  let adminUser, regularUser;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/tournament_test');
    
    // Initialize notification service
    notificationService = new NotificationService();
  });

  beforeEach(async () => {
    // Clear test data
    await User.deleteMany({});
    await Tournament.deleteMany({});
    await Registration.deleteMany({});
    await Notification.deleteMany({});

    // Create test admin user
    adminUser = new User({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@test.com',
      password: 'password123',
      phone: '+61412345678',
      state: 'NSW',
      preferredSports: ['Basketball'],
      isAdmin: true,
      isVerified: true
    });
    await adminUser.save();

    // Create test regular user
    regularUser = new User({
      firstName: 'Regular',
      lastName: 'User',
      email: 'user@test.com',
      password: 'password123',
      phone: '+61412345679',
      state: 'VIC',
      preferredSports: ['Basketball'],
      isVerified: true
    });
    await regularUser.save();

    // Get auth tokens
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'password123' });
    adminToken = adminLogin.body.token;

    const userLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'password123' });
    userToken = userLogin.body.token;

    // Create test tournament
    tournament = new Tournament({
      name: 'Test Basketball Tournament',
      sport: 'Basketball',
      format: 'Single Elimination',
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
      endDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
      registrationDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      venue: 'Test Sports Center',
      city: 'Sydney',
      state: 'NSW',
      maxParticipants: 16,
      entryFee: 50,
      prizePool: { first: 500, second: 200 },
      organizerBankDetails: {
        accountName: 'Test Organizer',
        bsb: '123456',
        accountNumber: '12345678',
        bankName: 'Test Bank'
      },
      status: 'Open',
      createdBy: adminUser._id
    });
    await tournament.save();

    // Create test registration
    registration = new Registration({
      tournament: tournament._id,
      type: 'Individual',
      captain: regularUser._id,
      paymentStatus: 'Pending',
      paymentReference: 'TEST123',
      status: 'Approved'
    });
    await registration.save();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Notification Model', () => {
    test('should create notification successfully', async () => {
      const notificationData = {
        recipient: regularUser._id,
        type: 'tournament',
        title: 'Test Notification',
        message: 'This is a test notification',
        priority: 'medium'
      };

      const notification = new Notification(notificationData);
      await notification.save();

      expect(notification._id).toBeDefined();
      expect(notification.title).toBe('Test Notification');
      expect(notification.isRead).toBe(false);
      expect(notification.timeAgo).toBeDefined();
    });

    test('should broadcast tournament update to all participants', async () => {
      const updateData = {
        type: 'announcement',
        title: 'Tournament Update',
        message: 'Important tournament announcement',
        priority: 'high'
      };

      const notifications = await Notification.broadcastTournamentUpdate(
        tournament._id,
        updateData
      );

      expect(notifications).toHaveLength(1);
      expect(notifications[0].recipient.toString()).toBe(regularUser._id.toString());
      expect(notifications[0].title).toBe('Tournament Update');
    });
  });

  describe('Notification API Endpoints', () => {
    test('should get user notifications', async () => {
      // Create test notification
      await new Notification({
        recipient: regularUser._id,
        type: 'tournament',
        title: 'Test Notification',
        message: 'Test message',
        priority: 'medium'
      }).save();

      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.notifications).toHaveLength(1);
      expect(response.body.data.unreadCount).toBe(1);
    });

    test('should mark notification as read', async () => {
      const notification = await new Notification({
        recipient: regularUser._id,
        type: 'tournament',
        title: 'Test Notification',
        message: 'Test message',
        priority: 'medium'
      }).save();

      const response = await request(app)
        .patch(`/api/notifications/${notification._id}/read`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const updatedNotification = await Notification.findById(notification._id);
      expect(updatedNotification.isRead).toBe(true);
    });

    test('should mark all notifications as read', async () => {
      // Create multiple notifications
      await Promise.all([
        new Notification({
          recipient: regularUser._id,
          type: 'tournament',
          title: 'Test 1',
          message: 'Test message 1',
          priority: 'medium'
        }).save(),
        new Notification({
          recipient: regularUser._id,
          type: 'payment',
          title: 'Test 2',
          message: 'Test message 2',
          priority: 'high'
        }).save()
      ]);

      const response = await request(app)
        .patch('/api/notifications/mark-all-read')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const notifications = await Notification.find({ recipient: regularUser._id });
      expect(notifications.every(n => n.isRead)).toBe(true);
    });

    test('should delete notification', async () => {
      const notification = await new Notification({
        recipient: regularUser._id,
        type: 'tournament',
        title: 'Test Notification',
        message: 'Test message',
        priority: 'medium'
      }).save();

      const response = await request(app)
        .delete(`/api/notifications/${notification._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const deletedNotification = await Notification.findById(notification._id);
      expect(deletedNotification).toBeNull();
    });

    test('should send tournament announcement (admin only)', async () => {
      const announcementData = {
        title: 'Important Announcement',
        message: 'This is an important tournament announcement',
        priority: 'high',
        sendEmail: false
      };

      const response = await request(app)
        .post(`/api/notifications/tournament/${tournament._id}/announcement`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(announcementData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.notificationCount).toBe(1);

      // Verify notification was created
      const notifications = await Notification.find({ 
        recipient: regularUser._id,
        type: 'announcement'
      });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toBe('Important Announcement');
    });

    test('should send weather/venue update (admin only)', async () => {
      const updateData = {
        type: 'weather',
        title: 'Weather Update',
        message: 'Tournament may be affected by weather conditions',
        weatherCondition: 'Heavy rain expected'
      };

      const response = await request(app)
        .post(`/api/notifications/tournament/${tournament._id}/weather-venue-update`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify notification was created
      const notifications = await Notification.find({ 
        recipient: regularUser._id,
        type: 'weather'
      });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].metadata.weather).toBe('Heavy rain expected');
    });

    test('should reject unauthorized tournament announcement', async () => {
      const announcementData = {
        title: 'Unauthorized Announcement',
        message: 'This should fail',
        priority: 'high'
      };

      const response = await request(app)
        .post(`/api/notifications/tournament/${tournament._id}/announcement`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(announcementData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Notification Service', () => {
    test('should notify payment status change', async () => {
      const notification = await notificationService.notifyPaymentStatusChange(
        registration._id,
        'Confirmed'
      );

      expect(notification).toBeDefined();
      expect(notification.recipient.toString()).toBe(regularUser._id.toString());
      expect(notification.type).toBe('payment');
      expect(notification.title).toContain('Payment Confirmed');
    });

    test('should notify upcoming tournaments', async () => {
      // Update tournament to start tomorrow
      tournament.startDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await tournament.save();

      const notifications = await notificationService.notifyUpcomingTournaments();

      expect(notifications).toHaveLength(1);
      expect(notifications[0].recipient.toString()).toBe(regularUser._id.toString());
      expect(notifications[0].title).toContain('Tournament Starting Tomorrow');
    });

    test('should notify team member addition', async () => {
      // Create team registration
      const teamRegistration = new Registration({
        tournament: tournament._id,
        type: 'Team',
        captain: regularUser._id,
        teamName: 'Test Team',
        teamMembers: [regularUser._id],
        paymentStatus: 'Confirmed',
        paymentReference: 'TEAM123',
        status: 'Approved'
      });
      await teamRegistration.save();

      // Create another user to add to team
      const newMember = new User({
        firstName: 'New',
        lastName: 'Member',
        email: 'newmember@test.com',
        password: 'password123',
        phone: '+61412345680',
        state: 'QLD',
        preferredSports: ['Basketball'],
        isVerified: true
      });
      await newMember.save();

      const notifications = await notificationService.notifyTeamMemberAdded(
        teamRegistration._id,
        newMember._id
      );

      expect(notifications).toHaveLength(2); // One for captain, one for new member
      expect(notifications[0].type).toBe('team');
      expect(notifications[1].type).toBe('team');
    });

    test('should clean up old notifications', async () => {
      // Create old read notification
      const oldNotification = new Notification({
        recipient: regularUser._id,
        type: 'system',
        title: 'Old Notification',
        message: 'This is old',
        priority: 'low',
        isRead: true,
        createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000) // 35 days ago
      });
      await oldNotification.save();

      // Create recent notification
      const recentNotification = new Notification({
        recipient: regularUser._id,
        type: 'system',
        title: 'Recent Notification',
        message: 'This is recent',
        priority: 'low',
        isRead: true
      });
      await recentNotification.save();

      const deletedCount = await notificationService.cleanupOldNotifications();

      expect(deletedCount).toBe(1);

      const remainingNotifications = await Notification.find({});
      expect(remainingNotifications).toHaveLength(1);
      expect(remainingNotifications[0].title).toBe('Recent Notification');
    });
  });

  describe('Notification Filtering', () => {
    beforeEach(async () => {
      // Create various types of notifications
      await Promise.all([
        new Notification({
          recipient: regularUser._id,
          type: 'tournament',
          title: 'Tournament Notification',
          message: 'Tournament message',
          priority: 'high'
        }).save(),
        new Notification({
          recipient: regularUser._id,
          type: 'payment',
          title: 'Payment Notification',
          message: 'Payment message',
          priority: 'urgent',
          isRead: true
        }).save(),
        new Notification({
          recipient: regularUser._id,
          type: 'schedule',
          title: 'Schedule Notification',
          message: 'Schedule message',
          priority: 'medium'
        }).save()
      ]);
    });

    test('should filter notifications by type', async () => {
      const response = await request(app)
        .get('/api/notifications?type=tournament')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.notifications).toHaveLength(1);
      expect(response.body.data.notifications[0].type).toBe('tournament');
    });

    test('should filter notifications by read status', async () => {
      const response = await request(app)
        .get('/api/notifications?isRead=false')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.notifications).toHaveLength(2); // tournament and schedule
      expect(response.body.data.notifications.every(n => !n.isRead)).toBe(true);
    });

    test('should filter notifications by priority', async () => {
      const response = await request(app)
        .get('/api/notifications?priority=urgent')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.notifications).toHaveLength(1);
      expect(response.body.data.notifications[0].priority).toBe('urgent');
    });

    test('should paginate notifications', async () => {
      const response = await request(app)
        .get('/api/notifications?page=1&limit=2')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.notifications).toHaveLength(2);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(2);
      expect(response.body.data.pagination.total).toBe(3);
    });
  });
});