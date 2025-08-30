# SportsTourneys - Tournament Management Platform

A full-stack sports tournament discovery and management platform built for players and teams to find, join, and track tournaments.

## 🏆 Features

### For Players/Teams
- **Tournament Discovery**: Browse and search tournaments by sport, location, and date
- **Easy Registration**: Register as individual player or team captain
- **Player Dashboard**: Track your tournaments, matches, and performance stats
- **Live Updates**: Real-time tournament progress and fixture tracking
- **Responsive Design**: Mobile-first design for players on-the-go

### For Organizers
- **Tournament Creation**: Set up tournaments with multiple formats (knockout, league, group+knockout)
- **Team Management**: Manage registrations and team confirmations
- **Fixture Generation**: Automatic fixture creation based on tournament format
- **Score Tracking**: Update match results and progress winners

## 🚀 Tech Stack

### Frontend
- **React 18** with TypeScript
- **TailwindCSS** for styling
- **React Router** for navigation
- **Axios** for API calls
- **Heroicons** for icons

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **JWT Authentication**
- **Express Validator** for input validation
- **bcryptjs** for password hashing

## 🛠️ Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- npm or yarn

### Quick Start with Docker
```bash
# Clone the repository
git clone <repository-url>
cd tournament-manager

# Start with Docker Compose
docker-compose up -d

# Seed the database with sample data
docker-compose exec backend npm run seed
```

### Manual Installation

1. **Clone and install dependencies**
```bash
git clone <repository-url>
cd tournament-manager

# Install root dependencies
npm install

# Install server dependencies
cd server && npm install && cd ..

# Install client dependencies  
cd client && npm install && cd ..
```

2. **Set up environment variables**
```bash
# Backend environment
cd server
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret

# Frontend environment
cd ../client
cp .env.example .env
# Edit .env with your API URL
```

3. **Start the application**
```bash
# Development mode (both frontend and backend)
npm run dev

# Or start separately:
npm run server  # Backend on http://localhost:5000
npm run client  # Frontend on http://localhost:5173
```

4. **Seed sample data**
```bash
npm run seed
```

## 📱 Usage

### For Players
1. **Browse Tournaments**: Visit the homepage to see upcoming tournaments
2. **Register Account**: Sign up with your sport and skill level
3. **Join Tournaments**: Register for tournaments that match your interests
4. **Track Progress**: Use your dashboard to follow your tournaments and matches

### For Admins
1. **Login**: Use admin credentials (admin@sportstourneys.com / admin123)
2. **Create Tournaments**: Set up new tournaments with custom rules
3. **Manage Teams**: Confirm team registrations and manage participants
4. **Update Results**: Enter match scores and progress winners

## 🔗 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user profile

### Tournaments
- `GET /api/tournaments` - List all tournaments (with filters)
- `GET /api/tournaments/:id` - Get tournament details
- `POST /api/tournaments` - Create tournament (admin)
- `PUT /api/tournaments/:id` - Update tournament (admin)

### Teams
- `POST /api/teams/register` - Register team for tournament
- `GET /api/teams/tournament/:id` - Get teams for tournament
- `PUT /api/teams/:id/status` - Update team status (admin)

### Fixtures
- `GET /api/fixtures/tournament/:id` - Get tournament fixtures
- `POST /api/fixtures` - Create fixture (admin)
- `PUT /api/fixtures/:id/score` - Update match score (admin)
- `POST /api/fixtures/generate/:id` - Generate tournament fixtures (admin)

## 🏗️ Project Structure

```
tournament-manager/
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API service functions
│   │   └── App.tsx          # Main app component
│   ├── tailwind.config.js   # TailwindCSS configuration
│   └── package.json
├── server/                   # Express backend
│   ├── models/              # Mongoose data models
│   ├── routes/              # API route handlers
│   ├── middleware/          # Custom middleware
│   ├── scripts/             # Utility scripts (seeding, etc.)
│   └── index.js             # Server entry point
├── docker-compose.yml       # Docker services configuration
├── Dockerfile              # Container build instructions
└── README.md
```

## 🚀 Deployment

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d --build

# For production with external MongoDB
docker-compose -f docker-compose.prod.yml up -d
```

### Manual Deployment

#### Frontend (Vercel/Netlify)
```bash
cd client
npm run build
# Deploy the 'dist' folder to your hosting service
```

#### Backend (Render/Railway/Heroku)
```bash
cd server
# Set environment variables in your hosting service
# Deploy the server folder
```

## 🔮 Future Features (Hooks Ready)

The application is structured to easily add:
- **Payment Integration**: Stripe/PayPal for tournament entry fees
- **Real-time Notifications**: Email/SMS updates for match schedules
- **Advanced Stats**: Player performance analytics and rankings
- **Live Scoring**: Real-time match score updates
- **Social Features**: Player profiles and team communication
- **Mobile App**: React Native mobile application

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, email support@sportstourneys.com or create an issue in this repository.