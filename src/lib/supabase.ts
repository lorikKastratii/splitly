import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Supabase configuration
// Get these from: Supabase Dashboard → Settings → API
const SUPABASE_URL = 'https://wuliefazkpwtclpndiic.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1bGllZmF6a3B3dGNscG5kaWljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMDY1MDcsImV4cCI6MjA4NDY4MjUwN30.CM72SMN0Wn1hj-RaL2OQ88XMPry1h98wp5Y5PKpXTEg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Database types for TypeScript
export interface DbUser {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  created_at: string;
}

export interface DbGroup {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  currency: string;
  invite_code: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DbGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: string;
}

export interface DbExpense {
  id: string;
  group_id: string;
  description: string;
  amount: number;
  currency: string;
  paid_by: string;
  split_type: string;
  category?: string;
  date: string;
  notes?: string;
  created_at: string;
}

export interface DbExpenseSplit {
  id: string;
  expense_id: string;
  user_id: string;
  amount: number;
  percentage?: number;
}

export interface DbSettlement {
  id: string;
  group_id: string;
  from_user: string;
  to_user: string;
  amount: number;
  currency: string;
  date: string;
  notes?: string;
  created_at: string;
}

export interface DbFriend {
  id: string;
  user_id: string;
  friend_user_id?: string;
  name: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  added_at: string;
}
