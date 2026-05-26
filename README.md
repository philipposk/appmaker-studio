# Vibecoders Web App

A modern web platform where developers can create, manage, and integrate their apps with GroqAPI, streamlining the development process.

## Features

- 🔐 **User Authentication** - Secure login and registration with JWT tokens
- 📱 **App Management** - Create, edit, and manage multiple apps
- 🔗 **Groq Integration** - Seamless integration with Groq API
- 👥 **Role-Based Access** - Developer and admin roles with appropriate permissions
- 🌓 **Dark/Light Mode** - Theme switching for comfortable coding
- 📊 **Dashboard & Analytics** - Track app performance and usage
- 🔒 **Privacy Settings** - Full control over data sharing and visibility

## Tech Stack

### Frontend
- React 18 with TypeScript
- Redux Toolkit for state management
- React Router for navigation
- Sass for styling with CSS variables
- Axios for API calls

### Backend
- Node.js with Express
- MongoDB with Mongoose
- JWT for authentication
- Groq SDK for AI integration
- bcryptjs for password hashing

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or Atlas)
- Groq API key (optional, can use default)

### Installation

1. **Clone the repository**
   ```bash
   cd "AppMaker 0.1"
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Set up environment variables**

   Create `backend/.env`:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/vibecoders
   JWT_SECRET=your-super-secret-jwt-key-change-in-production
   JWT_EXPIRE=7d
   GROQ_API_KEY=your-groq-api-key-here
   FRONTEND_URL=http://localhost:3000
   ```

   Create `frontend/.env`:
   ```env
   REACT_APP_API_URL=http://localhost:5000/api
   REACT_APP_GROQ_API_KEY=your-groq-api-key-here
   ```

5. **Start MongoDB**
   Make sure MongoDB is running on your system or update the MONGODB_URI to your MongoDB Atlas connection string.

6. **Start the backend server**
   ```bash
   cd backend
   npm run dev
   ```

7. **Start the frontend development server**
   ```bash
   cd frontend
   npm start
   ```

The app will be available at `http://localhost:3000`

## Project Structure

```
AppMaker 0.1/
├── backend/
│   ├── src/
│   │   ├── controllers/    # Route controllers
│   │   ├── models/         # Database models
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Auth middleware
│   │   ├── services/       # Business logic (Groq, etc.)
│   │   └── server.js       # Express server
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── store/          # Redux store and slices
│   │   ├── services/       # API service
│   │   ├── styles/         # Sass styles
│   │   └── App.tsx         # Main app component
│   └── package.json
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)

### Apps
- `GET /api/apps` - Get all apps (protected)
- `GET /api/apps/:id` - Get single app (protected)
- `POST /api/apps` - Create new app (protected)
- `PUT /api/apps/:id` - Update app (protected)
- `DELETE /api/apps/:id` - Delete app (protected)
- `POST /api/apps/:id/test-groq` - Test Groq integration (protected)

## Database Models

### User
- Authentication info (username, email, password)
- Profile information
- Privacy settings
- Subscription plan and limits
- App references

### App
- App metadata (name, description, type, status)
- Owner reference
- Groq configuration
- Integration status
- Statistics (views, interactions)

## Subscription Plans

- **Free**: 3 apps
- **Pro**: 20 apps
- **Enterprise**: Unlimited apps

## Development

### Running Tests
```bash
# Frontend tests
cd frontend
npm test

# Backend tests (to be implemented)
cd backend
npm test
```

### Building for Production
```bash
# Frontend
cd frontend
npm run build

# Backend
cd backend
npm start
```

## Contributing

This is a Vibecoders platform. Contributions, issues, and feature requests are welcome!

## License

This project is part of the Vibecoders platform.

