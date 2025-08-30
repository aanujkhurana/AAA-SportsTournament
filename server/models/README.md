# Sports Tournament Platform - Data Models

This directory contains the core data models for the Australian Sports Tournament Platform. All models are designed with Australian-specific requirements including states, phone numbers, banking details, and sports preferences.

## Models Overview

### 1. User Model (`User.js`)
Represents platform users including players, team captains, and administrators.

**Key Features:**
- Australian phone number validation
- Australian state/territory selection
- Sports preferences and skill levels
- Emergency contact information
- Admin role management
- Email verification system

**Australian-Specific Fields:**
- `state`: Australian states and territories
- `phone`: Australian phone number format validation
- `preferredSports`: Popular Australian sports

### 2. Tournament Model (`Tournament.js`)
Represents sports tournaments with comprehensive Australian location and banking details.

**Key Features:**
- Australian address structure with postcode validation
- Bank account details for entry fee collection
- Prize structure configuration
- Tournament format support (Single/Double Elimination, Round Robin, etc.)
- Participant capacity management
- Age and skill level restrictions

**Australian-Specific Fields:**
- `address`: Full Australian address with state and postcode
- `organizerBankDetails`: Australian BSB and account number validation
- `sport`: Popular Australian sports enumeration

### 3. Registration Model (`Registration.js`)
Handles both individual and team registrations for tournaments.

**Key Features:**
- Individual and team registration types
- Team member management and validation
- Payment reference generation
- Emergency contact requirements
- Medical and dietary information
- Automatic team size validation based on sport

**Validation Rules:**
- Team size validation per sport (e.g., Basketball: min 5 players)
- Unique payment reference generation
- Emergency contact phone validation

### 4. Payment Model (`Payment.js`)
Manages bank transfer payments and verification for Australian banking system.

**Key Features:**
- Bank transfer confirmation tracking
- Payment verification workflow
- File upload for payment receipts
- Admin verification system
- Refund management
- Payment status automation

**Australian Banking:**
- BSB and account number validation
- Bank transfer reference tracking
- Payment confirmation file management

### 5. Fixture Model (`Fixture.js`)
Manages tournament brackets and match scheduling.

**Key Features:**
- Tournament bracket management
- Match result tracking
- Automatic winner progression
- Multiple scoring formats (sets, overtime, forfeit)
- Referee and venue assignment
- Live streaming integration

**Bracket Management:**
- Automatic next match progression
- Bye handling for uneven participants
- Round and position tracking

## Database Indexes

All models include optimized indexes for Australian-specific queries:

- **User**: State, sports preferences, skill level
- **Tournament**: Sport, location (state/city), dates, entry fees
- **Registration**: Tournament + captain, payment reference, status
- **Payment**: Registration, tournament, verification status
- **Fixture**: Tournament + round, participants, scheduled dates

## Validation Features

### Australian Phone Numbers
```javascript
/^(\+61|0)[2-478](?:[ -]?[0-9]){8}$/
```

### Australian BSB Format
```javascript
/^\d{3}-?\d{3}$/
```

### Australian Account Numbers
```javascript
/^\d{6,10}$/
```

### Australian Postcodes
```javascript
/^\d{4}$/
```

## Model Relationships

```
User (1) ──── (N) Registration ──── (1) Tournament
  │                    │                    │
  │                    │                    │
  └── Admin ────── Creates ─────────────────┘
                       │
Registration (1) ──── (1) Payment
  │
  └── (2) Fixture (participant1, participant2)
```

## Usage Examples

### Creating a User
```javascript
const user = new User({
  firstName: 'John',
  lastName: 'Smith',
  email: 'john@example.com',
  password: 'securepassword',
  phone: '+61 412 345 678',
  state: 'New South Wales',
  preferredSports: ['Basketball', 'Tennis'],
  skillLevel: 'Intermediate',
  emergencyContact: {
    name: 'Jane Smith',
    phone: '+61 412 345 679',
    relationship: 'Spouse'
  }
});
```

### Creating a Tournament
```javascript
const tournament = new Tournament({
  name: 'Sydney Basketball Championship',
  sport: 'Basketball',
  format: 'Single Elimination',
  venue: 'Sydney Olympic Park',
  address: {
    street: '1 Olympic Boulevard',
    city: 'Sydney',
    state: 'New South Wales',
    postcode: '2127'
  },
  organizerBankDetails: {
    accountName: 'Sydney Basketball Association',
    bsb: '062-001',
    accountNumber: '12345678',
    bankName: 'Commonwealth Bank'
  },
  // ... other fields
});
```

### Team Registration
```javascript
const registration = new Registration({
  tournament: tournamentId,
  type: 'Team',
  captain: captainUserId,
  teamName: 'Thunder Bolts',
  teamMembers: [userId1, userId2, userId3],
  emergencyContact: {
    name: 'Emergency Contact',
    phone: '+61 412 345 678',
    relationship: 'Coach'
  }
});
```

## Middleware and Hooks

### Pre-save Middleware
- **User**: Password hashing with bcrypt
- **Registration**: Payment reference generation, team size validation
- **Payment**: Registration status updates, verification date setting
- **Fixture**: Winner determination, next match progression

### Post-save Middleware
- **Payment**: Automatic registration status updates
- **Fixture**: Winner progression to next bracket match

## Security Features

- Password hashing with bcrypt (12 rounds)
- Input validation and sanitization
- Australian banking detail validation
- File upload security for payment confirmations
- Role-based access control (admin/user)

## Performance Optimizations

- Strategic database indexing for Australian location searches
- Compound indexes for tournament filtering
- Efficient participant and payment status queries
- Optimized bracket progression queries

## Testing

Run the seed script to populate the database with sample Australian data:

```bash
npm run seed
```

This creates:
- Admin and sample users across Australian states
- Tournaments in major Australian cities
- Sample registrations and payments
- Tournament fixtures and brackets

## Environment Variables

Required environment variables:
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: JWT token secret
- `BCRYPT_ROUNDS`: Password hashing rounds (default: 12)

## Australian Compliance

All models are designed to comply with Australian:
- Privacy legislation requirements
- Banking and financial regulations
- Sports organization standards
- Accessibility guidelines (WCAG 2.1 AA)