// Stub file for Supabase compatibility - screens will use new API
// This prevents import errors while we migrate

export const supabase = {
  auth: {
    updateUser: async (updates: any) => {
      console.warn('supabase.auth.updateUser is deprecated - use api.updateProfile instead');
      return { error: new Error('Use new API client') };
    },
  },
  storage: {
    from: (bucket: string) => ({
      upload: async () => {
        console.warn('supabase.storage is deprecated - use api.uploadImage instead');
        return { error: new Error('Use new API client') };
      },
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
    }),
  },
};

// Type definitions for compatibility
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
