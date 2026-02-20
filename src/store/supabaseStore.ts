// Temporary stub - being migrated to use new API
import { create } from 'zustand';
import { Group, Expense, Settlement, User, Friend, Split, FriendRequest } from '../types';
import { api } from '../lib/api';
import { socketClient } from '../lib/socket';

const mapExpenses = (expenses: any[]): Expense[] =>
  expenses.map((e: any) => ({
    id: e.id,
    groupId: e.group_id,
    description: e.description,
    amount: parseFloat(e.amount),
    currency: e.currency,
    paidBy: e.paid_by,
    splitType: e.split_type,
    category: e.category,
    date: e.date,
    createdAt: e.created_at,
    notes: e.notes,
    splits: (e.splits || []).map((s: any) => ({
      userId: s.user_id,
      amount: parseFloat(s.amount),
      percentage: s.percentage,
    })),
  }));

const mapSettlements = (settlements: any[]): Settlement[] =>
  settlements.map((s: any) => ({
    id: s.id,
    groupId: s.group_id,
    from: s.from_user,
    to: s.to_user,
    amount: parseFloat(s.amount),
    currency: s.currency,
    date: s.date,
    createdAt: s.created_at,
    notes: s.notes,
  }));

const mapGroups = (groups: any[]): Group[] =>
  groups.map((g: any) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    imageUri: g.image_url,
    members: (g.members || []).map((m: any) => ({
      id: m.id,
      username: m.name,
      email: m.email,
      avatar: m.avatar_url,
    })),
    currency: g.currency,
    inviteCode: g.invite_code,
    expenseCount: g.expense_count || 0,
    totalSpent: g.total_spent || 0,
    createdAt: g.created_at,
    updatedAt: g.updated_at,
  }));

const mapFriends = (friends: any[]): Friend[] =>
  friends.map((f: any) => ({
    id: f.id,
    friendId: f.friend_user_id || f.id,
    username: f.name,
    email: f.email,
    avatar: f.linked_user_avatar || f.avatar_url,
    addedAt: f.added_at,
  }));

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

  addGroup: (group: Omit<Group, 'id' | 'createdAt' | 'updatedAt' | 'inviteCode'>) => Promise<{ id: string; inviteCode: string }>;
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
      const mappedGroups = mapGroups(groupsResponse.groups || []);
      set({ groups: mappedGroups });

      // Join socket rooms for all groups (for real-time updates)
      mappedGroups.forEach(g => socketClient.joinGroup(g.id));

      // Load expenses and settlements for all groups
      const allExpenses: Expense[] = [];
      const allSettlements: Settlement[] = [];
      await Promise.all(
        mappedGroups.map(async (group) => {
          try {
            const [expensesRes, settlementsRes] = await Promise.all([
              api.getGroupExpenses(group.id),
              api.getGroupSettlements(group.id),
            ]);
            if (expensesRes.expenses) {
              allExpenses.push(...mapExpenses(expensesRes.expenses));
            }
            if (settlementsRes.settlements) {
              allSettlements.push(...mapSettlements(settlementsRes.settlements));
            }
          } catch (e) {
            console.warn(`Failed to load data for group ${group.id}:`, e);
          }
        })
      );
      set({ expenses: allExpenses, settlements: allSettlements });

      // Load friends
      const friendsResponse = await api.getFriends();
      set({ friends: mapFriends(friendsResponse.friends || []) });

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
      set({ groups: mapGroups(groupsResponse.groups || []), lastUpdated: Date.now() });
    } catch (error) {
      console.error('Refresh groups error:', error);
    }
  },

  addGroup: async (group) => {
    try {
      // Map frontend field names to API field names
      const apiData: any = {
        name: group.name,
        description: group.description,
        currency: group.currency,
      };
      if (group.imageUri) apiData.image_url = group.imageUri;
      const response = await api.createGroup(apiData);
      await get().refreshGroups();
      return { id: response.group.id, inviteCode: response.group.invite_code };
    } catch (error) {
      console.error('Add group error:', error);
      throw error;
    }
  },

  updateGroup: async (id, group) => {
    try {
      // Map frontend field names to API field names
      const apiData: any = {};
      if (group.name !== undefined) apiData.name = group.name;
      if (group.description !== undefined) apiData.description = group.description;
      if (group.currency !== undefined) apiData.currency = group.currency;
      if (group.imageUri !== undefined) apiData.image_url = group.imageUri;
      await api.updateGroup(id, apiData);
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
    try {
      await api.addMemberToGroup(groupId, member.id);
      await get().refreshGroups();
    } catch (error) {
      console.error('Add member to group error:', error);
      throw error;
    }
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
        paid_by: expense.paidBy,
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
        from_user: settlement.from,
        to_user: settlement.to,
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
        friends: mapFriends(friendsResponse.friends || []),
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
      set({ friends: mapFriends(friendsResponse.friends || []) });
    } catch (error) {
      console.error('Delete friend error:', error);
      throw error;
    }
  },

  subscribeToGroups: () => {
    const handleExpenseAdded = (data: any) => {
      const expense = mapExpenses([data.expense])[0];
      if (!expense) return;
      set(state => {
        if (state.expenses.find(e => e.id === expense.id)) return state;
        return { expenses: [...state.expenses, expense], lastUpdated: Date.now() };
      });
    };

    const handleExpenseDeleted = (data: any) => {
      set(state => ({
        expenses: state.expenses.filter(e => e.id !== data.id),
        lastUpdated: Date.now(),
      }));
    };

    const handleSettlementAdded = (data: any) => {
      const settlement = mapSettlements([data.settlement])[0];
      if (!settlement) return;
      set(state => {
        if (state.settlements.find(s => s.id === settlement.id)) return state;
        return { settlements: [...state.settlements, settlement], lastUpdated: Date.now() };
      });
    };

    const handleSettlementDeleted = (data: any) => {
      set(state => ({
        settlements: state.settlements.filter(s => s.id !== data.id),
        lastUpdated: Date.now(),
      }));
    };

    const handleFriendRequestReceived = (data: any) => {
      const r = data.request;
      const newRequest: FriendRequest = {
        id: r.id,
        fromUser: r.from_user_id,
        toUser: r.to_user_id,
        fromUsername: r.from_username,
        fromAvatar: r.from_avatar,
        status: 'pending',
        createdAt: r.created_at,
      };
      set(state => {
        if (state.friendRequests.find(req => req.id === newRequest.id)) return state;
        return { friendRequests: [...state.friendRequests, newRequest] };
      });
    };

    const handleFriendRequestAccepted = (data: any) => {
      set(state => ({
        friendRequests: state.friendRequests.filter(r => r.id !== data.requestId),
      }));
      // Reload friends list to get the new friend
      api.getFriends().then(res => {
        set({ friends: mapFriends(res.friends || []) });
      }).catch(console.error);
    };

    socketClient.on('expense-added', handleExpenseAdded);
    socketClient.on('expense-deleted', handleExpenseDeleted);
    socketClient.on('settlement-added', handleSettlementAdded);
    socketClient.on('settlement-deleted', handleSettlementDeleted);
    socketClient.on('friend-request-received', handleFriendRequestReceived);
    socketClient.on('friend-request-accepted', handleFriendRequestAccepted);

    return () => {
      socketClient.off('expense-added', handleExpenseAdded);
      socketClient.off('expense-deleted', handleExpenseDeleted);
      socketClient.off('settlement-added', handleSettlementAdded);
      socketClient.off('settlement-deleted', handleSettlementDeleted);
      socketClient.off('friend-request-received', handleFriendRequestReceived);
      socketClient.off('friend-request-accepted', handleFriendRequestAccepted);
    };
  },
}));
