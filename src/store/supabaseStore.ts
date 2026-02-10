import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Group, Expense, Settlement, User, Friend, Split, FriendRequest } from '../types';
import { generateInviteCode, formatCurrency } from '../lib/utils';
import { useNotificationStore } from './notificationStore';

interface SupabaseStore {
  // State
  groups: Group[];
  expenses: Expense[];
  settlements: Settlement[];
  friends: Friend[];
  friendRequests: FriendRequest[];
  isLoading: boolean;
  userId: string | null;
  lastUpdated: number; // Timestamp to force re-renders on data changes

  // Initialize
  setUserId: (id: string | null) => void;
  loadData: () => Promise<void>;

  // Group actions
  addGroup: (group: Omit<Group, 'id' | 'createdAt' | 'updatedAt' | 'inviteCode'>) => Promise<string>;
  updateGroup: (id: string, group: Partial<Group>) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  addMemberToGroup: (groupId: string, member: User) => Promise<void>;
  removeMemberFromGroup: (groupId: string, memberId: string) => Promise<void>;
  joinGroupByCode: (code: string) => Promise<{ success: boolean; groupName?: string; error?: string }>;

  // Expense actions
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => Promise<void>;
  updateExpense: (id: string, expense: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;

  // Settlement actions
  addSettlement: (settlement: Omit<Settlement, 'id' | 'createdAt'>) => Promise<void>;
  deleteSettlement: (id: string) => Promise<void>;

  // Friend request actions
  sendFriendRequest: (toUserId: string) => Promise<void>;
  acceptFriendRequest: (requestId: string, fromUserId: string) => Promise<void>;
  rejectFriendRequest: (requestId: string) => Promise<void>;
  deleteFriend: (id: string) => Promise<void>;

  // Real-time subscriptions
  subscribeToGroups: () => () => void;
}

export const useSupabaseStore = create<SupabaseStore>((set, get) => ({
  groups: [],
  expenses: [],
  settlements: [],
  friends: [],
  friendRequests: [],
  isLoading: true,
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
    if (!userId) {
      set({ isLoading: false });
      return;
    }

    try {
      set({ isLoading: true });

      // Fetch groups user is a member of
      const { data: memberData } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', userId);

      const groupIds = memberData?.map((m) => m.group_id) || [];

      if (groupIds.length > 0) {
        // Fetch groups with members
        const { data: groupsData } = await supabase
          .from('groups')
          .select(`
            *,
            group_members (
              user_id,
              profiles (
                id,
                username,
                email,
                avatar_url
              )
            )
          `)
          .in('id', groupIds);

        // Transform to app format
        const groups: Group[] = (groupsData || []).map((g) => ({
          id: g.id,
          name: g.name,
          description: g.description,
          imageUri: g.image_url,
          currency: g.currency,
          inviteCode: g.invite_code,
          createdAt: g.created_at,
          updatedAt: g.updated_at,
          members: g.group_members?.map((gm: any) => {
            console.log('👤 Member loaded:', gm.profiles?.username, 'avatar:', gm.profiles?.avatar_url);
            return {
              id: gm.profiles?.id || gm.user_id,
              username: gm.profiles?.username || 'Unknown',
              email: gm.profiles?.email,
              avatar: gm.profiles?.avatar_url,
            };
          }) || [],
        }));

        // Fetch expenses for these groups
        const { data: expensesData } = await supabase
          .from('expenses')
          .select(`
            *,
            expense_splits (*)
          `)
          .in('group_id', groupIds);

        const expenses: Expense[] = (expensesData || []).map((e) => ({
          id: e.id,
          groupId: e.group_id,
          description: e.description,
          amount: parseFloat(e.amount),
          currency: e.currency,
          paidBy: e.paid_by,
          splitType: e.split_type,
          category: e.category,
          date: e.date,
          notes: e.notes,
          createdAt: e.created_at,
          splits: e.expense_splits?.map((s: any) => ({
            userId: s.user_id,
            amount: parseFloat(s.amount),
            percentage: s.percentage ? parseFloat(s.percentage) : undefined,
          })) || [],
        }));

        // Fetch settlements
        const { data: settlementsData } = await supabase
          .from('settlements')
          .select('*')
          .in('group_id', groupIds);

        const settlements: Settlement[] = (settlementsData || []).map((s) => ({
          id: s.id,
          groupId: s.group_id,
          from: s.from_user,
          to: s.to_user,
          amount: parseFloat(s.amount),
          currency: s.currency,
          date: s.date,
          notes: s.notes,
          createdAt: s.created_at,
        }));

        console.log('📦 Data loaded:', { groups: groups.length, expenses: expenses.length, settlements: settlements.length });
        set({ groups, expenses, settlements, lastUpdated: Date.now() });
      } else {
        console.log('📦 No groups found for user');
        set({ groups: [], expenses: [], settlements: [], lastUpdated: Date.now() });
      }

      // Fetch friends (with profile info of the friend)
      // Since we store mutual friendships (both directions), only fetch where user_id = us
      // This avoids duplicates
      const { data: friendsData } = await supabase
        .from('friends')
        .select(`
          id,
          user_id,
          friend_id,
          added_at,
          friend:friend_id (
            id,
            username,
            email,
            avatar_url
          )
        `)
        .eq('user_id', userId);

      const friends: Friend[] = (friendsData || []).map((f: any) => {
        return {
          id: f.id,
          friendId: f.friend_id,
          username: f.friend?.username || 'Unknown',
          email: f.friend?.email,
          avatar: f.friend?.avatar_url,
          addedAt: f.added_at,
        };
      });

      // Fetch friend requests (pending ones sent to us or by us)
      const { data: requestsData } = await supabase
        .from('friend_requests')
        .select(`
          id,
          from_user,
          to_user,
          status,
          created_at,
          from_profile:from_user (
            username,
            avatar_url
          ),
          to_profile:to_user (
            username,
            avatar_url
          )
        `)
        .or(`from_user.eq.${userId},to_user.eq.${userId}`)
        .eq('status', 'pending');

      const friendRequests: FriendRequest[] = (requestsData || []).map((r: any) => ({
        id: r.id,
        fromUser: r.from_user,
        toUser: r.to_user,
        status: r.status,
        createdAt: r.created_at,
        fromUsername: r.from_profile?.username,
        fromAvatar: r.from_profile?.avatar_url,
        toUsername: r.to_profile?.username,
        toAvatar: r.to_profile?.avatar_url,
      }));

      set({ friends, friendRequests, isLoading: false, lastUpdated: Date.now() });
    } catch (error) {
      console.error('Error loading data:', error);
      set({ isLoading: false });
    }
  },

  addGroup: async (group) => {
    const { userId } = get();
    if (!userId) {
      const error = new Error('Not authenticated');
      console.error('addGroup error: Not authenticated');
      throw error;
    }

    console.log('Creating group:', { name: group.name, userId });
    const inviteCode = generateInviteCode();

    // Create group - insert without select first due to RLS
    const { error: groupError } = await supabase
      .from('groups')
      .insert({
        name: group.name,
        description: group.description,
        image_url: group.imageUri,
        currency: group.currency,
        invite_code: inviteCode,
        created_by: userId,
      });

    if (groupError) {
      console.error('Group creation error:', {
        message: groupError.message,
        details: groupError.details,
        hint: groupError.hint,
        code: groupError.code,
      });
      throw groupError;
    }

    // Fetch the group ID by invite code (we just created it)
    const { data: createdGroup, error: fetchError } = await supabase
      .from('groups')
      .select('id')
      .eq('invite_code', inviteCode)
      .single();

    if (fetchError || !createdGroup) {
      console.error('Failed to fetch created group:', fetchError);
      throw fetchError || new Error('Group created but could not be fetched');
    }

    const groupId = createdGroup.id;
    console.log('Group created successfully:', groupId);

    // Add creator as member FIRST (required for RLS policies to work)
    const { error: memberError } = await supabase.from('group_members').insert({
      group_id: groupId,
      user_id: userId,
    });

    if (memberError) {
      console.error('Member creation error:', {
        message: memberError.message,
        details: memberError.details,
        hint: memberError.hint,
        code: memberError.code,
      });
      throw memberError;
    }

    console.log('Creator added as member');

    // Add other members if any (non-authenticated users stored by name)
    for (const member of group.members) {
      if (member.id !== 'me' && member.id !== userId) {
        // For now, these are local members - in a full implementation,
        // you'd invite them via email/phone
      }
    }

    // Reload data
    console.log('Reloading data after group creation...');
    await get().loadData();

    return inviteCode;
  },

  updateGroup: async (id, updates) => {
    const { error } = await supabase
      .from('groups')
      .update({
        name: updates.name,
        description: updates.description,
        image_url: updates.imageUri,
        currency: updates.currency,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
    await get().loadData();
  },

  deleteGroup: async (id) => {
    try {
      // Delete in order due to foreign key constraints
      // 1. Delete expense_splits for all expenses in this group
      const { data: groupExpenses } = await supabase
        .from('expenses')
        .select('id')
        .eq('group_id', id);
      
      if (groupExpenses && groupExpenses.length > 0) {
        const expenseIds = groupExpenses.map(e => e.id);
        await supabase
          .from('expense_splits')
          .delete()
          .in('expense_id', expenseIds);
      }

      // 2. Delete expenses
      await supabase.from('expenses').delete().eq('group_id', id);

      // 3. Delete settlements
      await supabase.from('settlements').delete().eq('group_id', id);

      // 4. Delete group_members
      await supabase.from('group_members').delete().eq('group_id', id);

      // 5. Finally delete the group
      const { error } = await supabase.from('groups').delete().eq('id', id);
      if (error) throw error;

      await get().loadData();
    } catch (error) {
      console.error('Error deleting group:', error);
      throw error;
    }
  },

  addMemberToGroup: async (groupId, member) => {
    // Add a user (friend) to a group by their user ID
    const { error } = await supabase
      .from('group_members')
      .insert({
        group_id: groupId,
        user_id: member.id, // member.id is the user's UUID
      });

    if (error) {
      // Ignore duplicate key error (user already in group)
      if (error.code !== '23505') {
        throw error;
      }
    }
    await get().loadData();
  },

  removeMemberFromGroup: async (groupId, memberId) => {
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', memberId);

    if (error) throw error;
    await get().loadData();
  },

  joinGroupByCode: async (code) => {
    const { userId } = get();
    console.log('=== JOIN GROUP ATTEMPT ===');
    console.log('Code:', code);
    console.log('UserId:', userId);
    
    if (!userId) {
      console.log('Error: Not logged in');
      return { success: false, error: 'You must be logged in to join a group' };
    }

    // Find group by invite code
    const { data: group, error: findError } = await supabase
      .from('groups')
      .select('id, name, invite_code')
      .ilike('invite_code', code.trim())
      .single();

    console.log('Find group result:', { group, findError });

    if (findError || !group) {
      console.log('Group not found. Error:', findError);
      return { success: false, error: 'Invalid invite code. Please check and try again.' };
    }

    // Check if already a member
    const { data: existingMember, error: memberCheckError } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', group.id)
      .eq('user_id', userId)
      .single();

    console.log('Existing member check:', { existingMember, memberCheckError });

    if (existingMember) {
      return { success: false, error: 'You are already a member of this group.' };
    }

    // Join the group
    console.log('Attempting to join group:', group.id);
    const { error: joinError } = await supabase.from('group_members').insert({
      group_id: group.id,
      user_id: userId,
    });

    console.log('Join result:', { joinError });

    if (joinError) {
      console.error('Join error details:', {
        message: joinError.message,
        details: joinError.details,
        hint: joinError.hint,
        code: joinError.code,
      });
      return { success: false, error: 'Failed to join group. Please try again.' };
    }

    // Reload data
    console.log('Join successful! Reloading data...');
    await get().loadData();

    return { success: true, groupName: group.name };
  },

  addExpense: async (expense) => {
    const { userId } = get();
    if (!userId) throw new Error('Not authenticated');

    // Create expense
    const { data: newExpense, error: expenseError } = await supabase
      .from('expenses')
      .insert({
        group_id: expense.groupId,
        description: expense.description,
        amount: expense.amount,
        currency: expense.currency,
        paid_by: expense.paidBy === 'me' ? userId : expense.paidBy,
        split_type: expense.splitType,
        category: expense.category,
        date: expense.date,
        notes: expense.notes,
      })
      .select()
      .single();

    if (expenseError) throw expenseError;

    // Create splits
    const splits = expense.splits.map((s) => ({
      expense_id: newExpense.id,
      user_id: s.userId === 'me' ? userId : s.userId,
      amount: s.amount,
      percentage: s.percentage,
    }));

    const { error: splitsError } = await supabase.from('expense_splits').insert(splits);
    if (splitsError) console.error('Error creating splits:', splitsError);

    // Broadcast to other users in the group for real-time sync
    // Use the subscribed group channel so all group members receive it
    const groupChannelMap = (get() as any)._groupChannelMap as Map<string, any> | undefined;
    const groupChannel = groupChannelMap?.get(expense.groupId);
    if (groupChannel) {
      console.log('📢 Broadcasting expense_added to group:', expense.groupId);
      await groupChannel.send({
        type: 'broadcast',
        event: 'expense_added',
        payload: { 
          groupId: expense.groupId,
          expenseId: newExpense.id,
          addedBy: userId,
        },
      });
      console.log('✅ Broadcast sent successfully');
    } else {
      console.warn('⚠️ No subscribed channel found for group:', expense.groupId);
    }

    // Add notification
    const { groups } = get();
    const group = groups.find((g) => g.id === expense.groupId);
    const paidByMember = group?.members.find((m) => m.id === expense.paidBy || (expense.paidBy === 'me' && m.id === userId));
    if (group) {
      useNotificationStore.getState().addNotification({
        type: 'expense_added',
        title: 'New Expense Added',
        message: `${paidByMember?.name || 'Someone'} added "${expense.description}" (${formatCurrency(expense.amount, expense.currency)}) in ${group.name}`,
        groupId: group.id,
        groupName: group.name,
      });
    }

    await get().loadData();
  },

  updateExpense: async (id, updates) => {
    const { error } = await supabase
      .from('expenses')
      .update({
        description: updates.description,
        amount: updates.amount,
        currency: updates.currency,
        paid_by: updates.paidBy,
        split_type: updates.splitType,
        category: updates.category,
        date: updates.date,
        notes: updates.notes,
      })
      .eq('id', id);

    if (error) throw error;
    
    // Get the expense to know its group
    const { expenses } = get();
    const expense = expenses.find(e => e.id === id);
    
    // Broadcast update to other users in the group
    if (expense) {
      const groupChannelMap = (get() as any)._groupChannelMap as Map<string, any> | undefined;
      const groupChannel = groupChannelMap?.get(expense.groupId);
      if (groupChannel) {
        console.log('📢 Broadcasting expense_updated to group:', expense.groupId);
        await groupChannel.send({
          type: 'broadcast',
          event: 'expense_updated',
          payload: { expenseId: id, groupId: expense.groupId },
        });
      }
    }
    
    await get().loadData();
  },

  deleteExpense: async (id) => {
    // Get the expense first to know the group
    const { expenses } = get();
    const expense = expenses.find(e => e.id === id);
    
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
    
    // Broadcast deletion to other users in the group
    if (expense) {
      const groupChannelMap = (get() as any)._groupChannelMap as Map<string, any> | undefined;
      const groupChannel = groupChannelMap?.get(expense.groupId);
      if (groupChannel) {
        console.log('📢 Broadcasting expense_deleted to group:', expense.groupId);
        await groupChannel.send({
          type: 'broadcast',
          event: 'expense_deleted',
          payload: { expenseId: id, groupId: expense.groupId },
        });
      }
    }
    
    await get().loadData();
  },

  addSettlement: async (settlement) => {
    const { userId } = get();
    if (!userId) throw new Error('Not authenticated');

    const { data: newSettlement, error } = await supabase.from('settlements').insert({
      group_id: settlement.groupId,
      from_user: settlement.from === 'me' ? userId : settlement.from,
      to_user: settlement.to === 'me' ? userId : settlement.to,
      amount: settlement.amount,
      currency: settlement.currency,
      date: settlement.date,
      notes: settlement.notes,
    }).select().single();

    if (error) throw error;

    // Broadcast settlement to other users in the group
    const groupChannelMap = (get() as any)._groupChannelMap as Map<string, any> | undefined;
    const groupChannel = groupChannelMap?.get(settlement.groupId);
    if (groupChannel) {
      console.log('📢 Broadcasting settlement_added to group:', settlement.groupId);
      await groupChannel.send({
        type: 'broadcast',
        event: 'settlement_added',
        payload: { 
          groupId: settlement.groupId,
          settlementId: newSettlement?.id,
        },
      });
    }

    // Add notification
    const { groups } = get();
    const group = groups.find((g) => g.id === settlement.groupId);
    const fromMember = group?.members.find((m) => m.id === settlement.from);
    const toMember = group?.members.find((m) => m.id === settlement.to);
    if (group) {
      useNotificationStore.getState().addNotification({
        type: 'settlement',
        title: 'Settlement Made',
        message: `${fromMember?.name || 'Someone'} paid ${toMember?.name || 'someone'} ${formatCurrency(settlement.amount, settlement.currency)} in ${group.name}`,
        groupId: group.id,
        groupName: group.name,
      });
    }

    await get().loadData();
  },

  deleteSettlement: async (id) => {
    // Get settlement first to know the group
    const { settlements } = get();
    const settlement = settlements.find(s => s.id === id);
    
    const { error } = await supabase.from('settlements').delete().eq('id', id);
    if (error) throw error;
    
    // Broadcast deletion to other users in the group
    if (settlement) {
      const groupChannelMap = (get() as any)._groupChannelMap as Map<string, any> | undefined;
      const groupChannel = groupChannelMap?.get(settlement.groupId);
      if (groupChannel) {
        console.log('📢 Broadcasting settlement_deleted to group:', settlement.groupId);
        await groupChannel.send({
          type: 'broadcast',
          event: 'settlement_deleted',
          payload: { settlementId: id, groupId: settlement.groupId },
        });
      }
    }
    
    await get().loadData();
  },

  sendFriendRequest: async (toUserId) => {
    const { userId, friends, friendRequests } = get();
    if (!userId) throw new Error('Not authenticated');

    // Check if already friends
    if (friends.some(f => f.friendId === toUserId)) {
      throw new Error('You are already friends with this user');
    }

    // Check if request already exists (in either direction)
    const existingRequest = friendRequests.find(
      r => (r.fromUser === userId && r.toUser === toUserId) ||
           (r.fromUser === toUserId && r.toUser === userId)
    );
    if (existingRequest) {
      throw new Error('A friend request already exists');
    }

    const { error } = await supabase.from('friend_requests').insert({
      from_user: userId,
      to_user: toUserId,
      status: 'pending',
    });

    if (error) throw error;
    await get().loadData();
  },

  acceptFriendRequest: async (requestId, fromUserId) => {
    const { userId } = get();
    if (!userId) throw new Error('Not authenticated');

    // Use the database function to accept the request
    // This creates mutual friendship (both directions) with SECURITY DEFINER
    const { error } = await supabase.rpc('accept_friend_request', {
      request_id: requestId,
    });

    if (error) throw error;

    await get().loadData();
  },

  rejectFriendRequest: async (requestId) => {
    const { error } = await supabase
      .from('friend_requests')
      .delete()
      .eq('id', requestId);

    if (error) throw error;
    await get().loadData();
  },

  deleteFriend: async (id) => {
    // Get the friend record to find both user IDs
    const { friends, userId } = get();
    const friend = friends.find(f => f.id === id);
    
    if (friend && userId) {
      // Delete both directions of friendship
      await supabase.from('friends').delete()
        .or(`and(user_id.eq.${userId},friend_id.eq.${friend.friendId}),and(user_id.eq.${friend.friendId},friend_id.eq.${userId})`);
      
      // Also delete any friend requests between these users (in both directions)
      await supabase.from('friend_requests').delete()
        .or(`and(from_user.eq.${userId},to_user.eq.${friend.friendId}),and(from_user.eq.${friend.friendId},to_user.eq.${userId})`);
    } else {
      // Fallback: just delete by id
      await supabase.from('friends').delete().eq('id', id);
    }
    
    await get().loadData();
  },

  subscribeToGroups: () => {
    const { userId, groups } = get();
    if (!userId) return () => {};

    console.log('🔴 Setting up real-time subscriptions for user:', userId);

    // Remove any existing subscription first
    supabase.removeAllChannels();

    // Debounce loadData to prevent multiple rapid calls
    let debounceTimer: NodeJS.Timeout | null = null;
    const debouncedLoadData = (source: string) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        console.log(`🔄 Reloading data from real-time trigger (${source})...`);
        await get().loadData();
        console.log('✅ Data reload complete');
      }, 300);
    };

    // Get group IDs user is a member of for filtering
    const groupIds = groups.map(g => g.id);
    console.log('📋 Subscribing to groups:', groupIds);

    // Store all channels for cleanup
    const channels: ReturnType<typeof supabase.channel>[] = [];
    
    // Map to store channels by group ID for broadcasting
    const groupChannelMap = new Map<string, ReturnType<typeof supabase.channel>>();
    
    // Store the map immediately so it's available for broadcasting
    (get() as any)._groupChannelMap = groupChannelMap;
    (get() as any)._groupIds = groupIds;

    // Create a SHARED channel for each group the user belongs to
    // This allows cross-user communication within the same group
    // Using :messages suffix to match Supabase RLS policies
    groupIds.forEach((groupId) => {
      const groupChannel = supabase.channel(`group:${groupId}:messages`, {
        config: {
          broadcast: { self: false, ack: false }, // Don't receive own broadcasts
        },
      });
      
      // Store channel immediately (before subscribe) so it's available for sending
      groupChannelMap.set(groupId, groupChannel);

      // Listen for broadcasts in this group
      groupChannel.on('broadcast', { event: 'expense_added' }, (payload) => {
        console.log(`📢 [Group ${groupId}] Broadcast: expense_added`, payload);
        debouncedLoadData('broadcast:expense_added');
      });

      groupChannel.on('broadcast', { event: 'expense_updated' }, (payload) => {
        console.log(`📢 [Group ${groupId}] Broadcast: expense_updated`, payload);
        debouncedLoadData('broadcast:expense_updated');
      });

      groupChannel.on('broadcast', { event: 'expense_deleted' }, (payload) => {
        console.log(`📢 [Group ${groupId}] Broadcast: expense_deleted`, payload);
        debouncedLoadData('broadcast:expense_deleted');
      });

      groupChannel.on('broadcast', { event: 'settlement_added' }, (payload) => {
        console.log(`📢 [Group ${groupId}] Broadcast: settlement_added`, payload);
        debouncedLoadData('broadcast:settlement_added');
      });

      groupChannel.on('broadcast', { event: 'settlement_deleted' }, (payload) => {
        console.log(`📢 [Group ${groupId}] Broadcast: settlement_deleted`, payload);
        debouncedLoadData('broadcast:settlement_deleted');
      });

      groupChannel.on('broadcast', { event: 'data_changed' }, (payload) => {
        console.log(`📢 [Group ${groupId}] Broadcast: data_changed`, payload);
        debouncedLoadData('broadcast:data_changed');
      });

      groupChannel.subscribe((status) => {
        console.log(`📡 Group channel ${groupId} status:`, status);
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Group channel ${groupId} ready for broadcasting`);
        }
      });

      channels.push(groupChannel);
    });

    // Also create a personal channel for postgres_changes (for database triggers)
    // Using :notifications suffix to match potential RLS policies
    const personalChannel = supabase.channel(`user:${userId}:notifications`, {
      config: {
        broadcast: { self: true },
        presence: { key: userId },
      },
    });

    // Subscribe to postgres_changes on this personal channel
    personalChannel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'groups' },
      (payload) => {
        console.log('🔄 Groups change:', payload.eventType);
        debouncedLoadData('groups');
      }
    );

    personalChannel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'group_members' },
      (payload) => {
        console.log('🔄 Group members change:', payload.eventType);
        debouncedLoadData('group_members');
      }
    );

    personalChannel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'expenses' },
      (payload) => {
        console.log('🔄 Expenses change:', payload.eventType);
        const expenseGroupId = (payload.new as any)?.group_id || (payload.old as any)?.group_id;
        const currentGroups = get().groups;
        const isRelevant = currentGroups.some(g => g.id === expenseGroupId);
        if (isRelevant || !expenseGroupId) {
          debouncedLoadData('expenses');
        }
      }
    );

    personalChannel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'expense_splits' },
      (payload) => {
        console.log('🔄 Expense splits change:', payload.eventType);
        debouncedLoadData('expense_splits');
      }
    );

    personalChannel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'settlements' },
      (payload) => {
        console.log('🔄 Settlements change:', payload.eventType);
        debouncedLoadData('settlements');
      }
    );

    personalChannel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'friends' },
      (payload) => {
        console.log('🔄 Friends change:', payload.eventType);
        debouncedLoadData('friends');
      }
    );

    personalChannel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'friend_requests' },
      (payload) => {
        console.log('🔄 Friend requests change:', payload.eventType);
        debouncedLoadData('friend_requests');
      }
    );

    personalChannel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profiles' },
      (payload) => {
        console.log('🔄 Profiles change:', payload.eventType);
        debouncedLoadData('profiles');
      }
    );

    personalChannel.subscribe(async (status, err) => {
      console.log('📡 Personal channel status:', status);
      if (err) {
        console.error('❌ Realtime error:', err);
      }
      if (status === 'SUBSCRIBED') {
        console.log('✅ Realtime connected!');
        await personalChannel.track({ 
          online_at: new Date().toISOString(),
          user_id: userId,
        });
      }
    });

    channels.push(personalChannel);

    return () => {
      console.log('🔴 Unsubscribing from real-time updates');
      if (debounceTimer) clearTimeout(debounceTimer);
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  },
}));
