# Quick Start Guide

Your Splitly app is ready to migrate to self-hosted PostgreSQL! Here's what you need to do:

## ✅ What You Have

- ✅ Railway PostgreSQL database (already set up)
- ✅ Backend code (Node.js + Express with JWT auth)
- ✅ Mobile app updated (removed Supabase, added Socket.io)

## 🚀 3-Step Setup

### Step 1: Get Railway Connection Details

1. Go to your Railway PostgreSQL service dashboard
2. Click on "Variables" tab
3. Find these two values:
   - `RAILWAY_TCP_PROXY_DOMAIN` (e.g., `viaduct.proxy.rlwy.net`)
   - `RAILWAY_TCP_PROXY_PORT` (e.g., `12345`)

4. Update `backend/.env` (lines 7-8):
   ```env
   DB_HOST=viaduct.proxy.rlwy.net  # Your actual domain
   DB_PORT=12345                    # Your actual port
   ```

### Step 2: Initialize Database

```bash
# Install backend dependencies
cd backend
npm install

# Initialize database with tables
npm run init-db
```

You should see:
```
✓ Database connection successful
✓ Schema file loaded
✓ Tables created successfully
✓ Found tables:
  - users
  - groups
  - group_members
  - expenses
  - expense_splits
  - settlements
  - friends
```

### Step 3: Start Backend

```bash
# Still in backend folder
npm run dev
```

You should see:
```
✓ Connected to PostgreSQL database
✓ Database connection verified
✓ Server running on port 3000
```

Test it:
```bash
curl http://localhost:3000/api/health
# Should return: {"status":"ok","timestamp":"..."}
```

## 🎉 That's It!

Now you can:

1. **Test the mobile app locally:**
   ```bash
   cd ..  # Back to root
   npm install
   npm start
   ```

2. **Create a test account:**
   - Open the app
   - Click "Sign Up"
   - Enter email, password, name
   - Start creating groups!

## 📱 Update Mobile App for Production

When you deploy the backend, update these files:

**`src/lib/api.ts` (line 3):**
```typescript
const API_URL = 'https://your-backend-url.railway.app/api';
```

**`src/lib/socket.ts` (line 4):**
```typescript
const SOCKET_URL = 'https://your-backend-url.railway.app';
```

## 🚂 Deploy Backend to Railway (Optional)

1. Push your code to GitHub
2. In Railway:
   - Click "New Service" → "GitHub Repo"
   - Select your repository
   - Set Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
3. Add environment variables (copy from `.env`)
4. Railway will auto-deploy and give you a URL

## 📚 Need More Help?

- **Railway setup details:** See [RAILWAY_SETUP.md](backend/RAILWAY_SETUP.md)
- **Complete migration guide:** See [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)
- **Backend API docs:** See [backend/README.md](backend/README.md)
- **Database schema:** See [backend/database/README.md](backend/database/README.md)

## 🆘 Troubleshooting

**Can't connect to database:**
- Make sure `DB_HOST` and `DB_PORT` are correct
- Railway requires SSL - it's already configured in the code

**npm run init-db fails:**
- Check that Railway database is accessible
- Verify credentials are correct

**Backend won't start:**
- Run `npm install` in backend folder
- Check all environment variables in `.env`

**Mobile app can't connect:**
- Make sure backend is running (`npm run dev`)
- Check API_URL in `src/lib/api.ts` matches your backend

## 🎯 What Changed?

| Before | After |
|--------|-------|
| Supabase hosted | Your Railway PostgreSQL |
| Supabase Auth | JWT tokens |
| Supabase Realtime | Socket.io |
| Auto API | Express REST API |

You now have **full control** over your backend! 🎉
