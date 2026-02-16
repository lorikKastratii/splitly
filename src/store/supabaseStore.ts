// Temporary stub - being migrated to use new API
import { create } from 'zustand';
import { Group, Expense, Settlement, User, Friend, Split, FriendRequest } from '../types';
import { api } from '../lib/api';
import { socketClient } from '../lib/socket';

const mapFriendRequests = (response: any): FriendRequest[] => [
  ...(response.received || []).map((r: any) => ({
    id: r.id,
    fromUser: r.from_user_id,
    toUser: r.to_user_id,
    fromUsername: r.from_username,
    fromAvatar: r.from_avatar,
    status: r.status,
    createdAt: r.created_at,
  })),
  ...(response.sent || []).map((r: any) => ({
    id: r.id,
    fromUser: r.from_user_id,
    toUser: r.to_user_id,
    toUsername: r.to_username,
    toAvatar: r.to_avatar,
    status: r.status,
    createdAt: r.created_at,
  })),
];

interface SupabaseStore {
  groups: Group[];
  expenses: Expense[];
  settlements: Settlement[];
  friends: Friend[];
  friendRequests: FriendRequest[];
  isLoading: boolean;
  userId: string | null;
  lastUpdated: number;

  setUserId: (id: string | null) => void;
  loadData: () => Promise<void>;
  refreshGroups: () => Promise<void>;

  addGroup: (group: Omit<Group, 'id' | 'createdAt' | 'updatedAt' | 'inviteCode'>) => Promise<string>;
  updateGroup: (id: string, group: Partial<Group>) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  addMemberToGroup: (groupId: string, member: User) => Promise<void>;
  removeMemberFromGroup: (groupId: string, memberId: string) => Promise<void>;
  joinGroupByCode: (code: string) => Promise<{ success: boolean; groupName?: string; error?: string }>;

  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => Promise<void>;
  updateExpense: (id: string, expense: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;

  addSettlement: (settlement: Omit<Settlement, 'id' | 'createdAt'>) => Promise<void>;
  deleteSettlement: (id: string) => Promise<void>;

  sendFriendRequest: (toUserId: string) => Promise<void>;
  acceptFriendRequest: (requestId: string, fromUserId: string) => Promise<void>;
  rejectFriendRequest: (requestId: string) => Promise<void>;
  deleteFriend: (id: string) => Promise<void>;

  subscribeToGroups: () => () => void;
}

export const useSupabaseStore = create<SupabaseStore>((set, get) => ({
  groups: [],
  expenses: [],
  settlements: [],
  friends: [],
  friendRequests: [],
  isLoading: false,
  userId: null,
  lastUpdated: Date.now(),

  setUserId: (id) => {
    set({ userId: id });
    if (id) {
      get().loadData();
    } else {
      set({ groups: [], expenses: [], settlements: [], friends: [] });
    }
  },

  loadData: async () => {
    const { userId } = get();
    if (!userId) return;

    try {
      set({ isLoading: true });

      // Load groups
      const groupsResponse = await api.getGroups();
      set({ groups: groupsResponse.groups || [] });

      // Load friends
      const friendsResponse = await api.getFriends();
      set({ friends: friendsResponse.friends || [] });

      // Load friend requests
      try {
        const requestsResponse = await api.getFriendRequests();
        set({ friendRequests: mapFriendRequests(requestsResponse) });
      } catch (e) {
        // Friend requests table might not exist yet
        console.warn('Failed to load friend requests:', e);
      }

      set({ lastUpdated: Date.now() });
    } catch (error) {
      console.error('Load data error:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  refreshGroups: async () => {
    try {
      const groupsResponse = await api.getGroups();
      set({ groups: groupsResponse.groups || [], lastUpdated: Date.now() });
    } catch (error) {
      console.error('Refresh groups error:', error);
    }
  },

  addGroup: async (group) => {
    try {
      const response = await api.createGroup(group);
      await get().refreshGroups();
      return response.group.id;
    } catch (error) {
      console.error('Add group error:', error);
      throw error;
    }
  },

  updateGroup: async (id, group) => {
    try {
      await api.updateGroup(id, group);
      await get().refreshGroups();
    } catch (error) {
      console.error('Update group error:', error);
      throw error;
    }
  },

  deleteGroup: async (id) => {
    try {
      await api.deleteGroup(id);
      await get().refreshGroups();
    } catch (error) {
      console.error('Delete group error:', error);
      throw error;
    }
  },

  joinGroupByCode: async (code) => {
    try {
      const response = await api.joinGroup(code);
      await get().refreshGroups();
      return { success: true, groupName: response.group.name };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  addMemberToGroup: async (groupId, member) => {
    console.warn('addMemberToGroup: Implement when needed');
  },

  removeMemberFromGroup: async (groupId, memberId) => {
    try {
      await api.leaveGroup(groupId);
      await get().refreshGroups();
    } catch (error) {
      console.error('Remove member error:', error);
      throw error;
    }
  },

  addExpense: async (expense) => {
    try {
      await api.createExpense({
        group_id: expense.groupId,
        description: expense.description,
        amount: expense.amount,
        currency: expense.currency,
        split_type: expense.splitType,
        category: expense.category,
        date: expense.date,
        notes: expense.notes,
        splits: expense.splits.map(s => ({
          user_id: s.userId,
          amount: s.amount,
          percentage: s.percentage,
        })),
      });
      set({ lastUpdated: Date.now() });
    } catch (error) {
      console.error('Add expense error:', error);
      throw error;
    }
  },

  updateExpense: async (id, expense) => {
    console.warn('updateExpense: Not yet implemented');
  },

  deleteExpense: async (id) => {
    try {
      await api.deleteExpense(id);
      set({ lastUpdated: Date.now() });
    } catch (error) {
      console.error('Delete expense error:', error);
      throw error;
    }
  },

  addSettlement: async (settlement) => {
    try {
      await api.createSettlement({
        group_id: settlement.groupId,
        to_user: settlement.toUser,
        amount: settlement.amount,
        currency: settlement.currency,
        date: settlement.date,
        notes: settlement.notes,
      });
      set({ lastUpdated: Date.now() });
    } catch (error) {
      console.error('Add settlement error:', error);
      throw error;
    }
  },

  deleteSettlement: async (id) => {
    try {
      await api.deleteSettlement(id);
      set({ lastUpdated: Date.now() });
    } catch (error) {
      console.error('Delete settlement error:', error);
      throw error;
    }
  },

  sendFriendRequest: async (toUserId) => {
    try {
      await api.sendFriendRequest(toUserId);
      const requestsResponse = await api.getFriendRequests();
      set({ friendRequests: mapFriendRequests(requestsResponse) });
    } catch (error) {
      console.error('Send friend request error:', error);
      throw error;
    }
  },

  acceptFriendRequest: async (requestId, fromUserId) => {
    try {
      await api.acceptFriendRequest(requestId);
      const [friendsResponse, requestsResponse] = await Promise.all([
        api.getFriends(),
        api.getFriendRequests(),
      ]);
      set({
        friends: friendsResponse.friends || [],
        friendRequests: mapFriendRequests(requestsResponse),
      });
    } catch (error) {
      console.error('Accept friend request error:', error);
      throw error;
    }
  },

  rejectFriendRequest: async (requestId) => {
    try {
      await api.rejectFriendRequest(requestId);
      const requestsResponse = await api.getFriendRequests();
      set({ friendRequests: mapFriendRequests(requestsResponse) });
    } catch (error) {
      console.error('Reject friend request error:', error);
      throw error;
    }
  },

  deleteFriend: async (id) => {
    try {
      await api.deleteFriend(id);
      const friendsResponse = await api.getFriends();
      set({ friends: friendsResponse.friends || [] });
    } catch (error) {
      console.error('Delete friend error:', error);
      throw error;
    }
  },

  subscribeToGroups: () => {
    // Socket.io subscriptions can be added here
    return () => {};
  },
}));
