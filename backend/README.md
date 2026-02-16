# Splitly Backend

Node.js + Express backend for the Splitly expense sharing app with PostgreSQL database.

## Features

- ✅ JWT authentication
- ✅ RESTful API
- ✅ PostgreSQL database
- ✅ Socket.io real-time updates
- ✅ File upload support
- ✅ Security headers (Helmet)
- ✅ CORS configured
- ✅ Compression
- ✅ Request logging

## Quick Start

### Prerequisites

- Node.js 16+ and npm
- PostgreSQL database (managed service recommended)

### Installation

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your database credentials
```

### Database Setup

1. Create a PostgreSQL database on your chosen provider
2. Run the schema file:
```bash
psql -h YOUR_HOST -U YOUR_USER -d YOUR_DATABASE -f database/schema.sql
```

### Running

```bash
# Development mode (auto-reload)
npm run dev

# Production mode
npm start
```

Server will start on `http://localhost:3000` (or PORT from .env)

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/profile` - Get user profile (auth required)
- `PUT /api/auth/profile` - Update profile (auth required)

### Groups
- `GET /api/groups` - Get user's groups
- `POST /api/groups` - Create group
- `GET /api/groups/:id` - Get group details
- `PUT /api/groups/:id` - Update group
- `DELETE /api/groups/:id` - Delete group
- `POST /api/groups/join` - Join group by invite code
- `DELETE /api/groups/:id/leave` - Leave group

### Expenses
- `GET /api/expenses/group/:groupId` - Get group expenses
- `POST /api/expenses` - Create expense
- `DELETE /api/expenses/:id` - Delete expense

### Settlements
- `GET /api/settlements/group/:groupId` - Get group settlements
- `POST /api/settlements` - Create settlement
- `DELETE /api/settlements/:id` - Delete settlement

### Friends
- `GET /api/friends` - Get friends list
- `POST /api/friends` - Add friend
- `PUT /api/friends/:id` - Update friend
- `DELETE /api/friends/:id` - Delete friend

### Upload
- `POST /api/upload` - Upload image (multipart/form-data)

### Health Check
- `GET /api/health` - Server health status

## Authentication

All protected endpoints require a Bearer token:
```
Authorization: Bearer <your-jwt-token>
```

Get a token by logging in or registering.

## WebSocket Events

### Client → Server
- `join-group` - Join a group room for real-time updates
- `leave-group` - Leave a group room

### Server → Client
- `expense-created` - New expense added to group
- `expense-deleted` - Expense removed
- `settlement-created` - New settlement recorded
- `group-updated` - Group details changed
- `member-joined` - New member joined group

## Environment Variables

See `.env.example` for all available variables.

Required:
- `DB_HOST` - PostgreSQL host
- `DB_PORT` - PostgreSQL port
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `JWT_SECRET` - Secret key for JWT signing

Optional:
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `UPLOAD_DIR` - Upload directory (default: ./uploads)
- `MAX_FILE_SIZE` - Max upload size in bytes (default: 5MB)
- `ALLOWED_ORIGINS` - CORS allowed origins (comma-separated)

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.js          # PostgreSQL connection
│   ├── controllers/
│   │   ├── authController.js    # Authentication logic
│   │   ├── groupController.js   # Group operations
│   │   ├── expenseController.js # Expense operations
│   │   ├── settlementController.js
│   │   ├── friendController.js
│   │   └── uploadController.js
│   ├── middleware/
│   │   ├── auth.js              # JWT verification
│   │   └── upload.js            # File upload config
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── groupRoutes.js
│   │   ├── expenseRoutes.js
│   │   ├── settlementRoutes.js
│   │   ├── friendRoutes.js
│   │   └── uploadRoutes.js
│   ├── utils/
│   │   ├── jwt.js               # JWT helpers
│   │   └── helpers.js           # Utility functions
│   └── server.js                # Main server file
├── database/
│   ├── schema.sql               # Database schema
│   └── README.md
├── package.json
└── .env.example
```

## Deployment

### Render

1. Push code to GitHub
2. Create new Web Service on Render
3. Set Root Directory to `backend`
4. Set Build Command: `npm install`
5. Set Start Command: `npm start`
6. Add environment variables
7. Deploy

### Railway

1. Create new project
2. Connect GitHub repo
3. Add environment variables
4. Deploy

### DigitalOcean App Platform

1. Create new app
2. Link GitHub repo
3. Configure as Node.js app
4. Add environment variables
5. Deploy

## Security

- Passwords hashed with bcrypt (10 rounds)
- JWT tokens expire after 7 days (configurable)
- Helmet.js for security headers
- CORS configured
- Input validation on all endpoints
- SQL injection protection (parameterized queries)

## Database

See `database/README.md` for database setup and schema details.

Tables:
- `users` - User accounts
- `groups` - Expense groups
- `group_members` - Group membership
- `expenses` - Expense records
- `expense_splits` - Expense distributions
- `settlements` - Payment records
- `friends` - User contacts

## Development

```bash
# Install dependencies
npm install

# Run in development mode (with auto-reload)
npm run dev

# Run linter (if configured)
npm run lint

# Run tests (if configured)
npm test
```

## Troubleshooting

**Database connection fails:**
- Check credentials in `.env`
- Verify database is accessible from your IP
- Ensure database exists

**JWT token invalid:**
- Check `JWT_SECRET` matches between environments
- Token may have expired

**CORS errors:**
- Add your frontend URL to `ALLOWED_ORIGINS` in `.env`

**File upload fails:**
- Check `UPLOAD_DIR` permissions
- Verify `MAX_FILE_SIZE` is not exceeded

## License

Private - All rights reserved
