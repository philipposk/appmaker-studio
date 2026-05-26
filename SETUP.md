# Vibecoders App - Quick Setup Guide

## Prerequisites Checklist

- [ ] Node.js v16+ installed
- [ ] MongoDB installed and running (or MongoDB Atlas account)
- [ ] Groq API key (optional, can use default)

## Quick Start

### 1. Backend Setup

```bash
cd backend
npm install
```

Create `backend/.env` file:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/vibecoders
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRE=7d
GROQ_API_KEY=your-groq-api-key-here
FRONTEND_URL=http://localhost:3000
```

Start backend:
```bash
npm run dev
```

### 2. Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env` file:
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_GROQ_API_KEY=your-groq-api-key-here
```

Start frontend:
```bash
npm start
```

### 3. Access the App

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api

## First Steps

1. Register a new account at http://localhost:3000/register
2. Login with your credentials
3. Create your first app from the dashboard
4. Test Groq integration in the app details page

## Database Models

### User
- Username, email, password
- Role (developer/admin)
- Subscription plan (free/pro/enterprise)
- App limits based on plan

### App
- Name, description, type
- Status (draft/active/paused/archived)
- Groq integration settings
- Statistics (views, interactions)

## Troubleshooting

### MongoDB Connection Error
- Make sure MongoDB is running: `mongod` or check your MongoDB Atlas connection string
- Update `MONGODB_URI` in backend/.env

### Port Already in Use
- Change `PORT` in backend/.env
- Update `REACT_APP_API_URL` in frontend/.env accordingly

### CORS Errors
- Make sure `FRONTEND_URL` in backend/.env matches your frontend URL
- Default: http://localhost:3000

## Next Steps

- Complete admin panel implementation
- Add notification system
- Enhance user profile and privacy settings
- Add more integrations
- Implement analytics dashboard

