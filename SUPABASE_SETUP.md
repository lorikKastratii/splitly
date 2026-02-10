# Splitly - Supabase Setup Guide

This guide will help you set up Supabase for real-time group syncing and invite codes.

## Quick Start

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click **"New Project"**
3. Fill in:
   - **Name**: `splitly` (or your preference)
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose closest to your users
4. Click **"Create new project"** (takes ~2 minutes)

### Step 2: Get API Credentials

1. Once project is ready, go to **Settings** → **API**
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGci...` (long string)

### Step 3: Update App Configuration

Open `src/lib/supabase.ts` and replace the placeholder values:

```typescript
const SUPABASE_URL = 'https://YOUR-PROJECT-ID.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

### Step 4: Set Up Database Tables

1. In Supabase Dashboard, go to **SQL Editor**
2. Click **"New Query"**
3. Copy the entire contents of `supabase-schema.sql` from this project
4. Paste into the SQL Editor
5. Click **"Run"** (green button)

You should see "Success. No rows returned" - this means all tables were created!

### Step 5: Enable Email Confirmation (Recommended)

1. Go to **Authentication** → **Providers**
2. Under **Email**, you can configure:
   - **Confirm email**: Toggle ON for production (OFF for testing)
   - **Secure email change**: Toggle ON

### Step 6: Test Your Setup

1. Run the app: `npm start`
2. Create an account using Sign Up
3. Create a group - you'll get an invite code
4. On another device (or simulator), sign up with a different account
5. Use the invite code to join the group
6. Both users should see the same group! 🎉

---

## Database Schema Overview

### Tables Created

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (linked to Supabase Auth) |
| `groups` | Groups with invite codes |
| `group_members` | Links users to groups |
| `expenses` | Expense records |
| `expense_splits` | How expenses are split |
| `settlements` | Payment records |
| `friends` | User's contact list |

### Row Level Security (RLS)

All tables have RLS policies that ensure:
- Users can only see groups they're members of
- Users can only modify their own data
- Anyone can look up a group by invite code (to join)

---

## How Invite Codes Work

1. **Creating a Group**:
   - App generates a unique 6-character code
   - Group is saved to Supabase with this code
   - Creator is automatically added as first member

2. **Sharing the Code**:
   - Creator shares the code via text, email, etc.
   - Code is stored in the `groups.invite_code` column

3. **Joining with Code**:
   - User enters the code in "Join Group"
   - App queries Supabase: `SELECT * FROM groups WHERE invite_code = 'ABC123'`
   - If found, user is added to `group_members`
   - Real-time sync updates both users' apps

---

## Troubleshooting

### "Invalid API Key"
- Double-check your `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- Make sure there are no extra spaces

### "Permission denied"
- Run the SQL schema again to ensure RLS policies exist
- Check that you're logged in (authenticated)

### Invite code not working
- Ensure the group was created by a logged-in user
- Check Supabase Dashboard → Table Editor → `groups` to see if the code exists

### Real-time not updating
- Check Supabase Dashboard → Database → Replication
- Enable replication for tables you want real-time on

---

## Environment Variables (Optional)

For production, use environment variables instead of hardcoding:

```bash
# .env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

Then update `supabase.ts`:
```typescript
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
```

---

## Need Help?

- [Supabase Docs](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)
- [React Native + Supabase Guide](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native)
