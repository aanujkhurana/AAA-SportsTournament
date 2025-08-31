# 🏆 Australian Sports Tournament Platform

A professional, sports-focused tournament management platform designed specifically for Australian athletes and sports organizations. Built with modern web technologies and featuring an intuitive, engaging design that puts sports at the center of the experience.

## 🌟 Features

### 🎯 **Sports-Focused Design**
- **Professional Visual Identity**: Modern gradient designs with Australian sports themes
- **Intuitive User Experience**: Sports-centric navigation and visual hierarchy
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Accessibility**: Full WCAG compliance with screen reader support

### 🏅 **Tournament Management**
- **Elite Tournament Discovery**: Browse premium tournaments across Australia
- **Advanced Filtering**: Search by sport, location, date, entry fee, and availability
- **Real-time Updates**: Live tournament status and participant tracking
- **Smart Scheduling**: AI-powered scheduling system for optimal match planning

### 🏃‍♂️ **Athlete Experience**
- **Performance Analytics**: Detailed statistics and progress tracking
- **Team Management**: Create and manage teams with roster tools
- **Secure Registration**: Bank-grade security for tournament registrations
- **Payment Processing**: Secure payment handling with instant verification

### 🏟️ **Sports Categories**
- **Basketball** 🏀 - Fast-paced indoor action
- **Football** ⚽ - Australia's favorite sport
- **Tennis** 🎾 - Individual excellence
- **Volleyball** 🏐 - Team coordination
- **Cricket** 🏏 - Strategic gameplay
- **Rugby** 🏉 - Physical intensity
- **Netball** 🥅 - Popular team sport
- **And more...**

## 🚀 Technology Stack

### **Frontend**
- **React 18** with TypeScript for type-safe development
- **Material-UI (MUI)** for professional component library
- **Vite** for lightning-fast development and builds
- **React Router** for seamless navigation
- **Axios** for API communication

### **Backend**
- **Node.js** with Express.js framework
- **MongoDB** with Mongoose ODM
- **JWT Authentication** for secure user sessions
- **Socket.io** for real-time updates
- **Multer** for file upload handling

### **Design & Styling**
- **Custom Sports Theme** with Australian color palette
- **Responsive Grid System** using Material-UI Grid2
- **Professional Typography** with Inter font family
- **Gradient Animations** and micro-interactions
- **Sports Iconography** throughout the interface

## 🎨 Design Philosophy

### **Sports-First Approach**
Every design decision prioritizes the sports experience:
- **Visual Hierarchy**: Tournament information is prominently displayed
- **Action-Oriented**: Clear call-to-action buttons for registration
- **Performance Focused**: Fast loading times for competitive athletes
- **Mobile-First**: Designed for athletes on the go

### **Professional Aesthetics**
- **Australian Sports Colors**: Orange (#FF6B35), Green (#2E7D32), Blue (#1565C0)
- **Modern Gradients**: Subtle gradients that enhance without overwhelming
- **Clean Typography**: Professional fonts that ensure readability
- **Consistent Spacing**: Harmonious layout with proper visual breathing room

## 🏗️ Project Structure

```
AAA-SportsTournament/
├── client/                     # React frontend application
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── ui/            # Enhanced UI components
│   │   │   ├── tournament/    # Tournament-specific components
│   │   │   ├── dashboard/     # Dashboard components
│   │   │   └── auth/          # Authentication components
│   │   ├── pages/             # Page components
│   │   ├── contexts/          # React contexts (Auth, Theme, Socket)
│   │   ├── hooks/             # Custom React hooks
│   │   ├── services/          # API services
│   │   ├── types/             # TypeScript type definitions
│   │   ├── constants/         # Application constants
│   │   ├── styles/            # SCSS stylesheets
│   │   └── theme/             # Material-UI theme configuration
│   └── public/                # Static assets
├── server/                     # Node.js backend application
│   ├── controllers/           # Route controllers
│   ├── models/               # MongoDB models
│   ├── routes/               # API routes
│   ├── middleware/           # Custom middleware
│   ├── services/             # Business logic services
│   └── tests/                # Backend tests
└── docs/                      # Documentation
```

## 🚀 Getting Started

### **Prerequisites**
- Node.js 18+ and npm
- MongoDB 5.0+
- Git

### **Installation**

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/AAA-SportsTournament.git
   cd AAA-SportsTournament
   ```

2. **Install dependencies**
   ```bash
   # Install backend dependencies
   cd server
   npm install

   # Install frontend dependencies
   cd ../client
   npm install
   ```

3. **Environment Setup**
   ```bash
   # Backend environment
   cd server
   cp .env.example .env
   # Edit .env with your configuration

   # Frontend environment
   cd ../client
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the development servers**
   ```bash
   # Start backend (from server directory)
   npm run dev

   # Start frontend (from client directory)
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5001

## 🎯 Key Features Implemented

### ✅ **Enhanced UI Components**
- **EnhancedTournamentCard**: Professional tournament display with hover effects
- **TournamentFilters**: Advanced filtering with real-time search
- **SportsLoader**: Animated loading screens with sports themes
- **StatusIndicator**: Real-time tournament status display
- **Badge System**: Sport-specific badges and achievement indicators

### ✅ **Professional Design Elements**
- **Gradient Backgrounds**: Subtle gradients throughout the interface
- **Hover Animations**: Smooth transitions and micro-interactions
- **Sports Iconography**: Consistent use of sports emojis and icons
- **Responsive Layout**: Mobile-first design with breakpoint optimization

### ✅ **Type Safety**
- **TypeScript Integration**: Full type coverage for better development experience
- **Interface Definitions**: Comprehensive type definitions for all data structures
- **API Type Safety**: Typed API responses and request parameters

## 🔧 Development

### **Available Scripts**

#### Frontend (client/)
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript compiler
npm test             # Run tests
```

#### Backend (server/)
```bash
npm run dev          # Start development server with nodemon
npm start            # Start production server
npm test             # Run tests
npm run seed         # Seed database with sample data
```

### **Code Quality**
- **ESLint**: Configured for React and TypeScript
- **Prettier**: Code formatting with consistent style
- **TypeScript**: Strict type checking enabled
- **Testing**: Vitest for frontend, Jest for backend

## 🎨 Design System

### **Color Palette**
- **Primary Orange**: #FF6B35 (Tournament highlights, CTAs)
- **Secondary Green**: #2E7D32 (Success states, Australian theme)
- **Accent Blue**: #1565C0 (Links, information)
- **Gold**: #FFD700 (Achievements, premium features)

### **Typography**
- **Primary Font**: Inter (Google Fonts)
- **Weights**: 300, 400, 500, 600, 700, 800, 900
- **Usage**: Professional, readable, modern

### **Component Library**
All components follow Material-UI design principles with custom Australian sports theming.

## 🚀 Deployment

### **Frontend Deployment**
```bash
cd client
npm run build
# Deploy dist/ folder to your hosting service
```

### **Backend Deployment**
```bash
cd server
npm run build  # If using TypeScript
# Deploy to your Node.js hosting service
```

### **Environment Variables**
Ensure all production environment variables are properly configured for:
- Database connections
- JWT secrets
- API endpoints
- File upload paths

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏆 Acknowledgments

- **Australian Sports Community** for inspiration and requirements
- **Material-UI Team** for the excellent component library
- **React Team** for the amazing framework
- **Unsplash Photographers** for high-quality sports imagery

---

**Built with ❤️ for Australian Sports**

*Empowering athletes to compete at the highest level through technology.*