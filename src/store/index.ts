import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Group, Expense, Settlement, User, Friend } from '../types';
import { generateId, generateInviteCode, formatCurrency } from '../lib/utils';
import { useNotificationStore } from './notificationStore';

interface AppState {
  groups: Group[];
  expenses: Expense[];
  settlements: Settlement[];
  friends: Friend[];
  isLoading: boolean;
  
  // Actions
  loadData: () => Promise<void>;
  saveData: () => Promise<void>;
  
  // Group actions
  addGroup: (group: Omit<Group, 'id' | 'createdAt' | 'updatedAt' | 'inviteCode'>) => string;
  updateGroup: (id: string, group: Partial<Group>) => void;
  deleteGroup: (id: string) => void;
  addMemberToGroup: (groupId: string, member: User) => void;
  removeMemberFromGroup: (groupId: string, memberId: string) => void;
  joinGroupByCode: (code: string, user: User) => { success: boolean; groupName?: string; error?: string };
  
  // Expense actions
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  updateExpense: (id: string, expense: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  
  // Settlement actions
  addSettlement: (settlement: Omit<Settlement, 'id' | 'createdAt'>) => void;
  deleteSettlement: (id: string) => void;
  
  // Friend actions
  addFriend: (friend: Omit<Friend, 'id' | 'addedAt'>) => void;
  updateFriend: (id: string, friend: Partial<Friend>) => void;
  deleteFriend: (id: string) => void;
}

export const useStore = create<AppState>((set, get) => ({
  groups: [],
  expenses: [],
  settlements: [],
  friends: [],
  isLoading: true,
  
  loadData: async () => {
    try {
      const [groupsData, expensesData, settlementsData, friendsData] = await Promise.all([
        AsyncStorage.getItem('groups'),
        AsyncStorage.getItem('expenses'),
        AsyncStorage.getItem('settlements'),
        AsyncStorage.getItem('friends'),
      ]);
      
      set({
        groups: groupsData ? JSON.parse(groupsData) : [],
        expenses: expensesData ? JSON.parse(expensesData) : [],
        settlements: settlementsData ? JSON.parse(settlementsData) : [],
        friends: friendsData ? JSON.parse(friendsData) : [],
        isLoading: false,
      });
    } catch (error) {
      console.error('Error loading data:', error);
      set({ isLoading: false });
    }
  },
  
  saveData: async () => {
    try {
      const { groups, expenses, settlements, friends } = get();
      await Promise.all([
        AsyncStorage.setItem('groups', JSON.stringify(groups)),
        AsyncStorage.setItem('expenses', JSON.stringify(expenses)),
        AsyncStorage.setItem('settlements', JSON.stringify(settlements)),
        AsyncStorage.setItem('friends', JSON.stringify(friends)),
      ]);
    } catch (error) {
      console.error('Error saving data:', error);
    }
  },
  
  addGroup: (group) => {
    const inviteCode = generateInviteCode();
    const newGroup: Group = {
      ...group,
      id: generateId(),
      inviteCode,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((state) => ({ groups: [...state.groups, newGroup] }));
    get().saveData();
    return inviteCode;
  },
  
  updateGroup: (id, updates) => {
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === id ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g
      ),
    }));
    get().saveData();
  },
  
  deleteGroup: (id) => {
    set((state) => ({
      groups: state.groups.filter((g) => g.id !== id),
      expenses: state.expenses.filter((e) => e.groupId !== id),
      settlements: state.settlements.filter((s) => s.groupId !== id),
    }));
    get().saveData();
  },
  
  addMemberToGroup: (groupId, member) => {
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId
          ? { ...g, members: [...g.members, member], updatedAt: new Date().toISOString() }
          : g
      ),
    }));
    get().saveData();
  },
  
  removeMemberFromGroup: (groupId, memberId) => {
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === groupId
          ? { ...g, members: g.members.filter((m) => m.id !== memberId), updatedAt: new Date().toISOString() }
          : g
      ),
    }));
    get().saveData();
  },

  joinGroupByCode: (code, user) => {
    const { groups } = get();
    const group = groups.find((g) => g.inviteCode && g.inviteCode.toUpperCase() === code.toUpperCase());
    
    if (!group) {
      return { success: false, error: 'Invalid invite code. Please check and try again.' };
    }
    
    // Check if user is already a member
    if (group.members.some((m) => m.id === user.id)) {
      return { success: false, error: 'You are already a member of this group.' };
    }
    
    // Add user to the group
    set((state) => ({
      groups: state.groups.map((g) =>
        g.id === group.id
          ? { ...g, members: [...g.members, user], updatedAt: new Date().toISOString() }
          : g
      ),
    }));
    get().saveData();
    
    return { success: true, groupName: group.name };
  },
  
  addExpense: (expense) => {
    const newExpense: Expense = {
      ...expense,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    set((state) => ({ expenses: [...state.expenses, newExpense] }));
    get().saveData();
    
    // Add notification
    const { groups } = get();
    const group = groups.find(g => g.id === expense.groupId);
    const paidByMember = group?.members.find(m => m.id === expense.paidBy);
    if (group) {
      useNotificationStore.getState().addNotification({
        type: 'expense_added',
        title: 'New Expense Added',
        message: `${paidByMember?.username || 'Someone'} added "${expense.description}" (${formatCurrency(expense.amount, expense.currency)}) in ${group.name}`,
        groupId: group.id,
        groupName: group.name,
      });
    }
  },
  
  updateExpense: (id, updates) => {
    set((state) => ({
      expenses: state.expenses.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    }));
    get().saveData();
  },
  
  deleteExpense: (id) => {
    set((state) => ({
      expenses: state.expenses.filter((e) => e.id !== id),
    }));
    get().saveData();
  },
  
  addSettlement: (settlement) => {
    const newSettlement: Settlement = {
      ...settlement,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    set((state) => ({ settlements: [...state.settlements, newSettlement] }));
    get().saveData();
    
    // Add notification
    const { groups } = get();
    const group = groups.find(g => g.id === settlement.groupId);
    const fromMember = group?.members.find(m => m.id === settlement.from);
    const toMember = group?.members.find(m => m.id === settlement.to);
    if (group) {
      useNotificationStore.getState().addNotification({
        type: 'settlement',
        title: 'Settlement Made',
        message: `${fromMember?.username || 'Someone'} paid ${toMember?.username || 'someone'} ${formatCurrency(settlement.amount, settlement.currency)} in ${group.name}`,
        groupId: group.id,
        groupName: group.name,
      });
    }
  },
  
  deleteSettlement: (id) => {
    set((state) => ({
      settlements: state.settlements.filter((s) => s.id !== id),
    }));
    get().saveData();
  },

  addFriend: (friend) => {
    const newFriend: Friend = {
      ...friend,
      id: generateId(),
      addedAt: new Date().toISOString(),
    };
    set((state) => ({ friends: [...state.friends, newFriend] }));
    get().saveData();
  },

  updateFriend: (id, updates) => {
    set((state) => ({
      friends: state.friends.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    }));
    get().saveData();
  },

  deleteFriend: (id) => {
    set((state) => ({
      friends: state.friends.filter((f) => f.id !== id),
    }));
    get().saveData();
  },
}));
