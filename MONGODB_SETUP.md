# MongoDB Setup Guide

## Option 1: MongoDB Atlas (Cloud - Recommended) ⭐

### Steps:
1. Go to https://www.mongodb.com/cloud/atlas/register
2. Sign up for a free account
3. Create a free cluster (M0 - Free tier)
4. Create a database user:
   - Go to "Database Access" → "Add New Database User"
   - Username: `vibecoders`
   - Password: (create a strong password)
   - Database User Privileges: "Atlas admin"
5. Whitelist your IP:
   - Go to "Network Access" → "Add IP Address"
   - Click "Allow Access from Anywhere" (for development) or add your IP
6. Get your connection string:
   - Go to "Database" → "Connect"
   - Choose "Connect your application"
   - Copy the connection string
   - It will look like: `mongodb+srv://vibecoders:<password>@cluster0.xxxxx.mongodb.net/vibecoders?retryWrites=true&w=majority`
7. Update `backend/.env`:
   ```env
   MONGODB_URI=mongodb+srv://vibecoders:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/vibecoders?retryWrites=true&w=majority
   ```
   Replace `YOUR_PASSWORD` with your actual password
8. Restart your backend server

## Option 2: Install MongoDB Locally

### macOS (using Homebrew):
```bash
# Install MongoDB
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB
brew services start mongodb-community

# Verify it's running
mongosh
```

### Your `.env` already has the local connection string:
```env
MONGODB_URI=mongodb://localhost:27017/vibecoders
```

### After installing, restart backend:
```bash
cd backend
npm run dev
```

## Verify MongoDB Connection

After setting up MongoDB, check if the backend connects:
- Look for: `✅ MongoDB connected` in your backend console
- If you see: `❌ MongoDB connection error` - check your connection string

## Quick Test

Once MongoDB is connected, try registering:
1. Go to http://localhost:3000/register
2. Fill out the form:
   - Username: `testuser`
   - Email: `test@example.com`
   - Password: `test123456`
   - First Name: `Test`
   - Last Name: `User`
3. Click "Sign Up"
4. You should be redirected to the dashboard!

## Troubleshooting

### MongoDB Atlas Connection Issues:
- Make sure your IP is whitelisted
- Check that your password doesn't have special characters (or URL-encode them)
- Verify the connection string is correct

### Local MongoDB Issues:
- Make sure MongoDB is running: `brew services list | grep mongo`
- Check if port 27017 is available: `lsof -i :27017`
- Try connecting manually: `mongosh`

