# Migration Guide: Supabase to Self-Hosted PostgreSQL

This guide will help you migrate your Splitly app from Supabase to a self-hosted PostgreSQL backend.

## Overview of Changes

### Backend (New)
- **Node.js + Express** server for REST API
- **PostgreSQL** database (managed service like AWS RDS, DigitalOcean, etc.)
- **JWT** authentication instead of Supabase Auth
- **Socket.io** for real-time updates instead of Supabase Realtime
- **Multer** for file uploads instead of Supabase Storage

### Mobile App (Updated)
- Removed `@supabase/supabase-js` dependency
- Added `socket.io-client` for real-time features
- New API client (`src/lib/api.ts`)
- New Socket.io client (`src/lib/socket.ts`)
- Updated auth context to use JWT tokens

## Step-by-Step Migration

### 1. Set Up Your PostgreSQL Database

Choose a managed PostgreSQL provider:
- **AWS RDS**: Great for production, auto-scaling
- **DigitalOcean Managed Database**: Simple, affordable
- **Render PostgreSQL**: Free tier available, easy setup
- **Railway**: Developer-friendly, good free tier

**Quick setup with Render (Free):**
1. Go to [render.com](https://render.com) and sign up
2. Click "New +" → "PostgreSQL"
3. Choose a name (e.g., "splitly-db")
4. Select "Free" plan
5. Click "Create Database"
6. Save your connection details (you'll need these)

### 2. Set Up the Backend

#### Install Dependencies
```bash
cd backend
npm install
```

#### Configure Environment Variables
```bash
cp .env.example .env
```

Edit `backend/.env` with your database credentials:
```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Database Configuration (from your provider)
DB_HOST=your-database-host.example.com
DB_PORT=5432
DB_NAME=splitly
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# JWT Configuration (generate a random secret)
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=7d

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880

# CORS (your mobile app and local dev)
ALLOWED_ORIGINS=http://localhost:19000,http://localhost:19001,http://localhost:19002
```

**Generate a secure JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Initialize the Database
Connect to your PostgreSQL database and run the schema:
```bash
# If using psql
psql -h YOUR_HOST -U YOUR_USER -d YOUR_DATABASE -f backend/database/schema.sql

# Or copy the contents of backend/database/schema.sql
# and run it in your database provider's console
```

#### Start the Backend
```bash
# Development
npm run dev

# Production
npm start
```

You should see:
```
✓ Connected to PostgreSQL database
✓ Database connection verified
✓ Server running on port 3000
```

### 3. Deploy the Backend

**Option A: Render (Recommended for beginners)**
1. Push your code to GitHub
2. Go to [render.com](https://render.com)
3. Click "New +" → "Web Service"
4. Connect your GitHub repo
5. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. Add environment variables from your `.env`
7. Click "Create Web Service"

**Option B: Railway**
1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub"
3. Select your repo
4. Add environment variables
5. Deploy

**Option C: DigitalOcean App Platform**
1. Create a new app
2. Link your GitHub repo
3. Configure build settings
4. Add environment variables
5. Deploy

### 4. Update Mobile App Configuration

#### Update API URL
Edit `src/lib/api.ts` (line 3):
```typescript
// For local development
const API_URL = 'http://localhost:3000/api';

// For production (replace with your backend URL)
const API_URL = 'https://your-backend.onrender.com/api';
```

Edit `src/lib/socket.ts` (line 4):
```typescript
// For local development
const SOCKET_URL = 'http://localhost:3000';

// For production
const SOCKET_URL = 'https://your-backend.onrender.com';
```

**Pro tip:** Use environment variables for this
```typescript
const API_URL = __DEV__
  ? 'http://localhost:3000/api'
  : 'https://your-backend.onrender.com/api';
```

#### Install New Dependencies
```bash
# Remove Supabase
npm uninstall @supabase/supabase-js base64-arraybuffer

# Install Socket.io client
npm install socket.io-client
```

### 5. Remove Old Supabase Files

You can remove these files (they're no longer needed):
```bash
rm src/lib/supabase.ts
rm src/store/supabaseStore.ts
rm supabase-*.sql
rm SUPABASE_SETUP.md
```

### 6. Test the Migration

#### Backend Testing
```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Test registration
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'
```

#### Mobile App Testing
1. Start the backend: `cd backend && npm run dev`
2. Start the mobile app: `cd .. && npm start`
3. Test these flows:
   - Sign up a new user
   - Sign in
   - Create a group
   - Add an expense
   - Verify real-time updates work

### 7. Data Migration (Optional)

If you have existing data in Supabase that you want to migrate:

**Export from Supabase:**
```sql
-- Run in Supabase SQL Editor
COPY (SELECT * FROM profiles) TO '/tmp/profiles.csv' CSV HEADER;
COPY (SELECT * FROM groups) TO '/tmp/groups.csv' CSV HEADER;
-- Repeat for other tables
```

**Import to PostgreSQL:**
```sql
-- Run in your new PostgreSQL database
COPY users FROM '/path/to/profiles.csv' CSV HEADER;
COPY groups FROM '/path/to/groups.csv' CSV HEADER;
-- Repeat for other tables
```

**Note:** You'll need to recreate user passwords since Supabase's password hashes are not compatible.

## Troubleshooting

### Backend won't start
- Check database credentials in `.env`
- Ensure PostgreSQL is accessible (check firewall rules)
- Verify all dependencies are installed: `npm install`

### Mobile app can't connect to backend
- Check API_URL matches your backend address
- For local development, use your computer's IP instead of `localhost` if testing on a physical device
- Check CORS settings in backend `.env`

### Socket.io not connecting
- Ensure backend is running and accessible
- Check that JWT token is valid
- Look for errors in mobile app console

### Database connection errors
- Verify database credentials
- Check if database allows connections from your IP
- Ensure database exists and schema is created

## Key Differences from Supabase

| Feature | Supabase | Self-Hosted |
|---------|----------|-------------|
| Auth | Built-in | Custom JWT |
| Database | Managed PostgreSQL | Your PostgreSQL |
| Real-time | Built-in subscriptions | Socket.io |
| Storage | Built-in | Multer + file system |
| RLS | Database-level | Application-level |
| API | Auto-generated | Manual REST endpoints |

## Performance Considerations

- **Database indexes**: Already included in schema
- **Connection pooling**: Configured in `backend/src/config/database.js`
- **File uploads**: Store on server or use S3/CloudFlare R2 for production
- **Real-time**: Socket.io scales well, but consider Redis adapter for multiple servers

## Security Checklist

- [ ] Change JWT_SECRET to a random value
- [ ] Use strong database password
- [ ] Enable SSL for database connections in production
- [ ] Add rate limiting (optional but recommended)
- [ ] Use HTTPS for backend API
- [ ] Validate all user inputs
- [ ] Keep dependencies updated

## Cost Comparison

**Supabase (Hosted):**
- Free tier: 500MB database, 1GB bandwidth
- Pro: $25/mo for 8GB database

**Self-Hosted:**
- Render: Free tier PostgreSQL + Free tier backend
- DigitalOcean: $15/mo for database + app
- AWS: ~$20-30/mo depending on usage

## Need Help?

- Check backend logs: `npm run dev` in backend folder
- Check mobile app logs in Expo console
- Review API responses in network tab
- Test endpoints with Postman or curl

## Rollback Plan

If you need to rollback to Supabase:
1. Restore `src/lib/supabase.ts`
2. Restore old `src/store/authContext.tsx` from git
3. Reinstall Supabase: `npm install @supabase/supabase-js`
4. Update imports in all screens

---

**🎉 Congratulations!** You've successfully migrated from Supabase to a self-hosted PostgreSQL backend. You now have full control over your database and backend infrastructure!
