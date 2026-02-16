# Railway Setup Guide

## Database Configuration

Your Railway PostgreSQL is already set up! Here are your credentials:

- **Database**: railway
- **User**: postgres
- **Password**: ylpALgzTBkzIWteCmhypRPkmHljGjhBz

## Getting Connection Details

### Option 1: Use Individual Variables (Recommended)

1. Go to your Railway PostgreSQL service
2. Click on the "Variables" tab
3. Find these values:
   - `RAILWAY_TCP_PROXY_DOMAIN` (e.g., viaduct.proxy.rlwy.net)
   - `RAILWAY_TCP_PROXY_PORT` (e.g., 12345)

4. Update `backend/.env`:
```env
DB_HOST=viaduct.proxy.rlwy.net  # Your actual domain
DB_PORT=12345                    # Your actual port
DB_NAME=railway
DB_USER=postgres
DB_PASSWORD=ylpALgzTBkzIWteCmhypRPkmHljGjhBz
```

### Option 2: Use DATABASE_PUBLIC_URL Directly

1. Copy the full `DATABASE_PUBLIC_URL` from Railway
2. It looks like: `postgresql://postgres:ylpALgzTBkzIWteCmhypRPkmHljGjhBz@viaduct.proxy.rlwy.net:12345/railway`

3. Update `backend/src/config/database.js` to use it directly:

```javascript
const { Pool } = require('pg');
require('dotenv').config();

// Option 1: Use DATABASE_URL directly
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL,
  ssl: {
    rejectUnauthorized: false // Railway uses SSL
  }
});

// OR Option 2: Use individual variables (current setup)
// Just make sure DB_HOST and DB_PORT are correct

pool.on('connect', () => {
  console.log('✓ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
  process.exit(-1);
});

module.exports = { pool };
```

## Initialize Database Schema

Once your connection is configured:

### Method 1: Using psql (if installed)

```bash
# Get your DATABASE_PUBLIC_URL from Railway
psql "postgresql://postgres:ylpALgzTBkzIWteCmhypRPkmHljGjhBz@YOUR_DOMAIN:YOUR_PORT/railway" -f backend/database/schema.sql
```

### Method 2: Using Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run schema
railway run psql -f backend/database/schema.sql
```

### Method 3: Using Railway Web Console

1. Go to your Railway PostgreSQL service
2. Click "Data" tab
3. Click "Query"
4. Copy and paste the entire contents of `backend/database/schema.sql`
5. Click "Execute"

### Method 4: Using Node.js Script

I can create a script to initialize the database:

```bash
cd backend
npm install
node scripts/initDatabase.js
```

## SSL Configuration

Railway requires SSL connections. Update `backend/src/config/database.js`:

```javascript
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false  // Add this for Railway
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

## Deploy Backend to Railway

1. **Create new service:**
   - Go to your Railway project
   - Click "New Service" → "GitHub Repo"
   - Select your repository
   - Set Root Directory: `backend`

2. **Add environment variables:**
   - Add all variables from your `.env` file
   - Railway will automatically provide `DATABASE_URL` if services are in same project

3. **Configure:**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Port: Railway auto-detects port 3000

4. **Deploy:**
   - Railway will auto-deploy when you push to GitHub

## Testing Connection

```bash
cd backend
npm install
npm run dev
```

You should see:
```
✓ Connected to PostgreSQL database
✓ Database connection verified
✓ Server running on port 3000
```

## Troubleshooting

**Connection timeout:**
- Railway requires SSL - make sure SSL config is added
- Check that TCP proxy domain/port are correct

**SSL/TLS error:**
- Add `ssl: { rejectUnauthorized: false }` to pool config

**No tables found:**
- Run the schema file (see methods above)
- Check that schema was executed successfully

## Next Steps

1. ✅ Configure database connection
2. ✅ Initialize database schema
3. ✅ Test backend locally
4. ✅ Deploy backend to Railway
5. ✅ Update mobile app API URLs
6. ✅ Test end-to-end
