export interface User {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
}

export interface Friend {
  id: string;
  friendId: string;
  username: string;
  email?: string;
  avatar?: string;
  addedAt: string;
}

export interface FriendRequest {
  id: string;
  fromUser: string;
  toUser: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  // Populated from profiles
  fromUsername?: string;
  fromAvatar?: string;
  toUsername?: string;
  toAvatar?: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  imageUri?: string;
  members: User[];
  currency: Currency;
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
  expenseCount?: number;
  totalSpent?: number;
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  currency: Currency;
  paidBy: string;
  splitType: SplitType;
  splits: Split[];
  category?: ExpenseCategory;
  date: string;
  createdAt: string;
  notes?: string;
}

export interface Split {
  userId: string;
  amount: number;
  percentage?: number;
}

export interface Settlement {
  id: string;
  groupId: string;
  from: string;
  to: string;
  amount: number;
  currency: Currency;
  date: string;
  createdAt: string;
  notes?: string;
}

export type SplitType = 'equal' | 'percentage' | 'exact';

export type Currency = 'USD' | 'EUR' | 'GBP' | 'INR' | 'JPY' | 'CAD' | 'AUD';

export type ExpenseCategory =
  | 'food'
  | 'transport'
  | 'accommodation'
  | 'entertainment'
  | 'shopping'
  | 'utilities'
  | 'other';

export interface Balance {
  userId: string;
  amount: number;
}

export interface SimplifiedDebt {
  from: string;
  to: string;
  amount: number;
}
