const mongoose = require('mongoose');

// Database connection utility
class Database {
  constructor() {
    this.connection = null;
  }

  async connect(uri, options = {}) {
    try {
      const defaultOptions = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10, // Maintain up to 10 socket connections
        serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
        socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        bufferMaxEntries: 0, // Disable mongoose buffering
        bufferCommands: false, // Disable mongoose buffering
      };

      const connectionOptions = { ...defaultOptions, ...options };
      
      this.connection = await mongoose.connect(uri, connectionOptions);
      
      console.log(`✅ MongoDB connected successfully to: ${this.connection.connection.host}`);
      
      // Handle connection events
      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        console.log('⚠️ MongoDB disconnected');
      });

      mongoose.connection.on('reconnected', () => {
        console.log('✅ MongoDB reconnected');
      });

      return this.connection;
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error.message);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.connection) {
        await mongoose.disconnect();
        console.log('✅ MongoDB disconnected successfully');
        this.connection = null;
      }
    } catch (error) {
      console.error('❌ Error disconnecting from MongoDB:', error.message);
      throw error;
    }
  }

  getConnection() {
    return this.connection;
  }

  isConnected() {
    return mongoose.connection.readyState === 1;
  }

  // Create database indexes for optimal performance
  async createIndexes() {
    try {
      console.log('🔧 Creating database indexes...');

      // User indexes
      await mongoose.model('User').collection.createIndex({ email: 1 }, { unique: true });
      await mongoose.model('User').collection.createIndex({ state: 1 });
      await mongoose.model('User').collection.createIndex({ preferredSports: 1 });
      await mongoose.model('User').collection.createIndex({ skillLevel: 1 });

      // Tournament indexes
      await mongoose.model('Tournament').collection.createIndex({ sport: 1 });
      await mongoose.model('Tournament').collection.createIndex({ 'address.state': 1 });
      await mongoose.model('Tournament').collection.createIndex({ 'address.city': 1 });
      await mongoose.model('Tournament').collection.createIndex({ status: 1 });
      await mongoose.model('Tournament').collection.createIndex({ startDate: 1 });
      await mongoose.model('Tournament').collection.createIndex({ registrationDeadline: 1 });
      await mongoose.model('Tournament').collection.createIndex({ entryFee: 1 });
      await mongoose.model('Tournament').collection.createIndex({ createdBy: 1 });

      // Registration indexes
      await mongoose.model('Registration').collection.createIndex({ tournament: 1, captain: 1 });
      await mongoose.model('Registration').collection.createIndex({ paymentReference: 1 }, { unique: true });
      await mongoose.model('Registration').collection.createIndex({ status: 1, paymentStatus: 1 });
      await mongoose.model('Registration').collection.createIndex({ tournament: 1, type: 1 });

      // Payment indexes
      await mongoose.model('Payment').collection.createIndex({ registration: 1 });
      await mongoose.model('Payment').collection.createIndex({ tournament: 1 });
      await mongoose.model('Payment').collection.createIndex({ paymentReference: 1 });
      await mongoose.model('Payment').collection.createIndex({ verificationStatus: 1 });
      await mongoose.model('Payment').collection.createIndex({ createdAt: -1 });

      // Fixture indexes
      await mongoose.model('Fixture').collection.createIndex({ tournament: 1, round: 1 });
      await mongoose.model('Fixture').collection.createIndex({ tournament: 1, status: 1 });
      await mongoose.model('Fixture').collection.createIndex({ scheduledDate: 1 });
      await mongoose.model('Fixture').collection.createIndex({ participant1: 1 });
      await mongoose.model('Fixture').collection.createIndex({ participant2: 1 });
      await mongoose.model('Fixture').collection.createIndex({ bracketPosition: 1 });

      console.log('✅ Database indexes created successfully');
    } catch (error) {
      console.error('❌ Error creating database indexes:', error.message);
      throw error;
    }
  }

  // Clean up expired data
  async cleanupExpiredData() {
    try {
      console.log('🧹 Cleaning up expired data...');

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Remove old unverified users
      const unverifiedUsers = await mongoose.model('User').deleteMany({
        isVerified: false,
        createdAt: { $lt: thirtyDaysAgo }
      });

      // Remove old rejected payments
      const rejectedPayments = await mongoose.model('Payment').deleteMany({
        verificationStatus: 'Rejected',
        createdAt: { $lt: thirtyDaysAgo }
      });

      console.log(`✅ Cleanup completed: ${unverifiedUsers.deletedCount} unverified users, ${rejectedPayments.deletedCount} rejected payments removed`);
    } catch (error) {
      console.error('❌ Error during cleanup:', error.message);
      throw error;
    }
  }

  // Get database statistics
  async getStats() {
    try {
      const stats = {
        users: await mongoose.model('User').countDocuments(),
        tournaments: await mongoose.model('Tournament').countDocuments(),
        registrations: await mongoose.model('Registration').countDocuments(),
        payments: await mongoose.model('Payment').countDocuments(),
        fixtures: await mongoose.model('Fixture').countDocuments(),
        activeTournaments: await mongoose.model('Tournament').countDocuments({ 
          status: { $in: ['Open', 'InProgress'] } 
        }),
        pendingPayments: await mongoose.model('Payment').countDocuments({ 
          verificationStatus: 'Pending' 
        })
      };

      return stats;
    } catch (error) {
      console.error('❌ Error getting database stats:', error.message);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new Database();