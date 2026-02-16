# Database Setup

## Prerequisites

You need a PostgreSQL database. You can use any managed PostgreSQL service:
- AWS RDS
- DigitalOcean Managed PostgreSQL
- Google Cloud SQL
- Render PostgreSQL
- Supabase (just the database, not the full platform)
- Railway

## Setup Steps

### 1. Create a PostgreSQL Database

On your chosen platform, create a new PostgreSQL database (version 12+).

Save the following connection details:
- Host
- Port (usually 5432)
- Database name
- Username
- Password

### 2. Run the Schema

Connect to your database and run the `schema.sql` file:

**Option A: Using psql command line**
```bash
psql -h YOUR_HOST -U YOUR_USER -d YOUR_DATABASE -f database/schema.sql
```

**Option B: Using a GUI tool**
- Open pgAdmin, DBeaver, or your database provider's web interface
- Copy the contents of `schema.sql`
- Paste and execute

### 3. Verify Tables

Check that all tables were created:
```sql
\dt
```

You should see:
- users
- groups
- group_members
- expenses
- expense_splits
- settlements
- friends

### 4. Configure Backend

Copy `.env.example` to `.env` in the backend directory:
```bash
cd backend
cp .env.example .env
```

Edit `.env` with your database credentials:
```env
DB_HOST=your-database-host.com
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_username
DB_PASSWORD=your_password
JWT_SECRET=generate-a-random-secret-here
```

### 5. Test Connection

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

## Database Schema

### users
Stores user accounts with hashed passwords (replaces Supabase auth).

### groups
Expense sharing groups with unique invite codes.

### group_members
Many-to-many relationship between users and groups.

### expenses
Individual expense records with amount, description, etc.

### expense_splits
How each expense is divided among group members.

### settlements
Records of payments between users to settle debts.

### friends
User's personal contact list for quick adding to groups.

## Security Notes

- Passwords are hashed using bcrypt before storage
- JWT tokens are used for authentication
- All database permissions are handled at the application level
- Make sure to use SSL/TLS for database connections in production
- Never commit your `.env` file with real credentials
