const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const tournamentRoutes = require('./routes/tournaments');
const teamRoutes = require('./routes/teams');
const fixtureRoutes = require('./routes/fixtures');
const registrationRoutes = require('./routes/registrations');
const paymentRoutes = require('./routes/payments');
const userRoutes = require('./routes/users');
const notificationRoutes = require('./routes/notifications');

const NotificationService = require('./services/notificationService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Make io available to routes
app.set('io', io);

// Initialize notification service with socket.io
const notificationService = new NotificationService(io);
app.set('notificationService', notificationService);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/fixtures', fixtureRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Tournament Manager API is running' });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tournament_manager')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join user to their personal room for targeted notifications
  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined their notification room`);
  });

  // Handle tournament room joining for real-time bracket updates
  socket.on('joinTournament', (tournamentId) => {
    socket.join(`tournament_${tournamentId}`);
    console.log(`User joined tournament room: ${tournamentId}`);
  });

  // Handle leaving tournament room
  socket.on('leaveTournament', (tournamentId) => {
    socket.leave(`tournament_${tournamentId}`);
    console.log(`User left tournament room: ${tournamentId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Scheduled tasks for notifications
const cron = require('node-cron');

// Check for upcoming tournaments daily at 9 AM
cron.schedule('0 9 * * *', async () => {
  try {
    console.log('Running daily notification check for upcoming tournaments...');
    await notificationService.notifyUpcomingTournaments();
  } catch (error) {
    console.error('Error in scheduled notification check:', error);
  }
});

// Clean up old notifications weekly on Sunday at 2 AM
cron.schedule('0 2 * * 0', async () => {
  try {
    console.log('Running weekly cleanup of old notifications...');
    await notificationService.cleanupOldNotifications();
  } catch (error) {
    console.error('Error in scheduled notification cleanup:', error);
  }
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('WebSocket server initialized');
});

module.exports = app;