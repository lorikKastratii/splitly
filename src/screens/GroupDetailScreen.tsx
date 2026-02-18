import React, { useMemo, useState, useLayoutEffect, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Share,
  Image,
  RefreshControl,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useSupabaseStore as useStore } from '../store/supabaseStore';
import { useAuth } from '../store/authContext';
import { Expense, Group, User, Settlement } from '../types';
import { api } from '../lib/api';
import { format } from 'date-fns';
import { calculateBalances, simplifyDebts } from '../lib/calculations';
import { useTheme } from '../theme/ThemeContext';
import { shadows } from '../theme/colors';
import { formatCurrency } from '../lib/utils';
import Avatar from '../components/Avatar';

type GroupDetailScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'GroupDetail'
>;
type GroupDetailScreenRouteProp = RouteProp<RootStackParamList, 'GroupDetail'>;

interface Props {
  navigation: GroupDetailScreenNavigationProp;
  route: GroupDetailScreenRouteProp;
}

type TabType = 'expenses' | 'balances' | 'myExpenses';

export default function GroupDetailScreen({ navigation, route }: Props) {
  const { group } = route.params;
  const { groups, addSettlement, loadData, lastUpdated } = useStore();
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';
  const [activeTab, setActiveTab] = useState<TabType>('expenses');
  const [refreshing, setRefreshing] = useState(false);
  const [localMembers, setLocalMembers] = useState<User[]>([]);
  const [localExpenses, setLocalExpenses] = useState<Expense[]>([]);
  const [localSettlements, setLocalSettlements] = useState<Settlement[]>([]);
  const { colors, isDark } = useTheme();

  const fetchGroupData = useCallback(async () => {
    try {
      const [groupRes, expensesRes, settlementsRes] = await Promise.all([
        api.getGroup(group.id),
        api.getGroupExpenses(group.id),
        api.getGroupSettlements(group.id),
      ]);

      if (groupRes.group?.members) {
        setLocalMembers(groupRes.group.members.map((m: any) => ({
          id: m.id,
          username: m.name,
          email: m.email,
          avatar: m.avatar_url,
        })));
      }

      if (expensesRes.expenses) {
        setLocalExpenses(expensesRes.expenses.map((e: any) => ({
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
        })));
      }

      if (settlementsRes.settlements) {
        setLocalSettlements(settlementsRes.settlements.map((s: any) => ({
          id: s.id,
          groupId: s.group_id,
          from: s.from_user,
          to: s.to_user,
          amount: parseFloat(s.amount),
          currency: s.currency,
          date: s.date,
          createdAt: s.created_at,
          notes: s.notes,
        })));
      }
    } catch (error) {
      console.error('Failed to fetch group data:', error);
    }
  }, [group.id]);

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadData(), fetchGroupData()]);
    setRefreshing(false);
  }, [loadData, fetchGroupData]);

  useEffect(() => {
    fetchGroupData();
  }, [fetchGroupData]);

  // Get updated group from store
  const currentGroup = groups.find((g) => g.id === group.id) || group;

  // Debug logging - disabled for production
  // console.log('=== GROUP DETAIL DEBUG ===');
  // console.log('currentUserId:', currentUserId);
  // console.log('group members:', currentGroup.members.map(m => ({ id: m.id, name: m.name })));
  // console.log('expenses:', expenses.filter(e => e.groupId === currentGroup.id).map(e => ({ 
  //   description: e.description, 
  //   paidBy: e.paidBy,
  //   splits: e.splits 
  // })));

  const getAvatarColor = (index: number) => {
    return colors.avatarColors[index % colors.avatarColors.length];
  };

  // Add Edit button to header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerBackTitle: '', // Remove "MainTabs" text, show only back arrow
      headerRight: () => (
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleShareInviteCode}
          >
            <Text style={[styles.headerButtonText, { color: colors.textInverse }]}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('EditGroup', { groupId: currentGroup.id })}
          >
            <Text style={[styles.headerButtonText, { color: colors.textInverse }]}>Edit</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, currentGroup.id, currentGroup.inviteCode, colors.textInverse]);

  const handleShareInviteCode = async () => {
    try {
      await Share.share({
        message: `Join my group "${currentGroup.name}" on Splitly!\n\nUse invite code: ${currentGroup.inviteCode}`,
      });
    } catch (error) {
      Alert.alert(
        'Invite Code',
        `Share this code with friends:\n\n${currentGroup.inviteCode}`,
        [{ text: 'OK' }]
      );
    }
  };

  const groupExpenses = useMemo(
    () => [...localExpenses].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    ),
    [localExpenses]
  );

  const balances = useMemo(
    () => calculateBalances(groupExpenses, localMembers, localSettlements),
    [groupExpenses, localMembers, localSettlements]
  );

  const suggestedSettlements = useMemo(
    () => simplifyDebts(balances),
    [balances]
  );

  // Filter settlements to only show ones the current user is involved in
  const mySettlements = useMemo(
    () => suggestedSettlements.filter(
      (debt) => debt.from === currentUserId || false || debt.to === currentUserId || false
    ),
    [suggestedSettlements, currentUserId]
  );

  // Calculate what I owe and what I'm owed
  const myBalanceSummary = useMemo(() => {
    let iOwe = 0;
    let owedToMe = 0;
    
    suggestedSettlements.forEach((debt) => {
      if (debt.from === currentUserId || false) {
        iOwe += debt.amount;
      } else if (debt.to === currentUserId || false) {
        owedToMe += debt.amount;
      }
    });
    
    return { iOwe, owedToMe };
  }, [suggestedSettlements, currentUserId]);

  // Calculate personal expenses for current user
  const myExpensesByCategory = useMemo(() => {
    const categoryTotals: Record<string, { amount: number; count: number }> = {};
    
    groupExpenses.forEach((expense) => {
      const mySplit = expense.splits.find((s) => s.userId === currentUserId || s.userId === currentUserId);
      if (mySplit) {
        const category = expense.category || 'other';
        if (!categoryTotals[category]) {
          categoryTotals[category] = { amount: 0, count: 0 };
        }
        categoryTotals[category].amount += mySplit.amount;
        categoryTotals[category].count += 1;
      }
    });
    
    return Object.entries(categoryTotals).map(([category, data]) => ({
      category,
      amount: data.amount,
      count: data.count,
    })).sort((a, b) => b.amount - a.amount);
  }, [groupExpenses, currentUserId]);

  const myTotalExpenses = useMemo(
    () => myExpensesByCategory.reduce((sum, cat) => sum + cat.amount, 0),
    [myExpensesByCategory]
  );

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      food: '🍔',
      transport: '🚗',
      accommodation: '🏨',
      entertainment: '🎬',
      shopping: '🛍️',
      utilities: '💡',
      other: '📦',
    };
    return icons[category] || '📦';
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      food: 'Food & Drinks',
      transport: 'Transport',
      accommodation: 'Accommodation',
      entertainment: 'Entertainment',
      shopping: 'Shopping',
      utilities: 'Utilities',
      other: 'Other',
    };
    return labels[category] || 'Other';
  };

  const totalSpent = useMemo(
    () => groupExpenses.reduce((sum, e) => sum + e.amount, 0),
    [groupExpenses]
  );

  const getMemberName = (userId: string) => {
    return localMembers.find((m) => m.id === userId)?.username || 'Unknown';
  };

  const getMemberIndex = (userId: string) => {
    return localMembers.findIndex((m) => m.id === userId);
  };

  const getMemberAvatar = (userId: string) => {
    return localMembers.find((m) => m.id === userId)?.avatar;
  };

  const renderExpense = ({ item }: { item: Expense }) => {
    const paidByIndex = getMemberIndex(item.paidBy);
    const splitWith = item.splits.length;

    return (
      <TouchableOpacity style={[styles.expenseCard, { backgroundColor: colors.card }]} activeOpacity={0.7}>
        <View style={styles.expenseLeft}>
          <Avatar 
            name={getMemberName(item.paidBy)} 
            index={paidByIndex} 
            size={40} 
            userId={item.paidBy}
            imageUri={getMemberAvatar(item.paidBy)}
          />
          <View style={styles.expenseInfo}>
            <Text style={[styles.expenseDescription, { color: colors.text }]}>{item.description}</Text>
            <Text style={[styles.expenseDetail, { color: colors.textSecondary }]}>
              Paid by {getMemberName(item.paidBy)} • Split with {splitWith}
            </Text>
          </View>
        </View>
        <View style={styles.expenseRight}>
          <Text style={[styles.expenseAmount, { color: colors.text }]}>
            {formatCurrency(item.amount, item.currency)}
          </Text>
          <Text style={[styles.expenseDate, { color: colors.textMuted }]}>
            {item.date ? format(new Date(item.date), 'MMM d') : 'No date'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Summary Header */}
      <View style={[styles.summaryHeader, { backgroundColor: colors.primary }]}>
        <View style={[styles.summaryCard, { backgroundColor: colors.primary }]}>
          <Text style={[styles.summaryLabel, { color: 'rgba(255,255,255,0.7)' }]}>Total Spent</Text>
          <Text style={[styles.summaryAmount, { color: colors.textInverse }]}>
            {formatCurrency(totalSpent, currentGroup.currency)}
          </Text>
          <Text style={[styles.summarySubtext, { color: 'rgba(255,255,255,0.6)' }]}>
            {groupExpenses.length} expense{groupExpenses.length !== 1 ? 's' : ''} •{' '}
            {localMembers.length} members
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'expenses' && [styles.tabActive, { borderBottomColor: colors.primary }]]}
          onPress={() => setActiveTab('expenses')}
        >
          <Text
            style={[
              styles.tabText,
              { color: colors.textSecondary },
              activeTab === 'expenses' && [styles.tabTextActive, { color: colors.primary }],
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'myExpenses' && [styles.tabActive, { borderBottomColor: colors.primary }]]}
          onPress={() => setActiveTab('myExpenses')}
        >
          <Text
            style={[
              styles.tabText,
              { color: colors.textSecondary },
              activeTab === 'myExpenses' && [styles.tabTextActive, { color: colors.primary }],
            ]}
          >
            My Expenses
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'balances' && [styles.tabActive, { borderBottomColor: colors.primary }]]}
          onPress={() => setActiveTab('balances')}
        >
          <Text
            style={[
              styles.tabText,
              { color: colors.textSecondary },
              activeTab === 'balances' && [styles.tabTextActive, { color: colors.primary }],
            ]}
          >
            Balances
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'expenses' ? (
        <View style={[styles.content, { backgroundColor: colors.background }]}>
          {groupExpenses.length === 0 ? (
            <ScrollView
              contentContainerStyle={styles.emptyState}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
              }
            >
              <Text style={styles.emptyIcon}>💸</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No expenses yet</Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Add your first expense to start tracking
              </Text>
            </ScrollView>
          ) : (
            <FlatList
              data={groupExpenses}
              extraData={lastUpdated}
              renderItem={renderExpense}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
              }
            />
          )}
        </View>
      ) : activeTab === 'myExpenses' ? (
        <ScrollView 
          style={[styles.content, { backgroundColor: colors.background }]} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
        >
          {/* My Total */}
          <View style={styles.section}>
            <View style={[styles.myTotalCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.myTotalLabel, { color: colors.textSecondary }]}>My Total Spending</Text>
              <Text style={[styles.myTotalAmount, { color: colors.text }]}>
                {formatCurrency(myTotalExpenses, currentGroup.currency)}
              </Text>
              <Text style={[styles.myTotalSubtext, { color: colors.textMuted }]}>
                Your share across {myExpensesByCategory.reduce((sum, c) => sum + c.count, 0)} expenses
              </Text>
            </View>

            {/* Balance Summary */}
            <View style={styles.balanceSummaryRow}>
              <View style={[styles.balanceSummaryCard, { backgroundColor: colors.dangerLight }]}>
                <Text style={[styles.balanceSummaryLabel, { color: colors.danger }]}>I Owe</Text>
                <Text style={[styles.balanceSummaryAmount, { color: colors.danger }]}>
                  {formatCurrency(myBalanceSummary.iOwe, currentGroup.currency)}
                </Text>
              </View>
              <View style={[styles.balanceSummaryCard, { backgroundColor: colors.successLight }]}>
                <Text style={[styles.balanceSummaryLabel, { color: colors.success }]}>Owed to Me</Text>
                <Text style={[styles.balanceSummaryAmount, { color: colors.success }]}>
                  {formatCurrency(myBalanceSummary.owedToMe, currentGroup.currency)}
                </Text>
              </View>
            </View>
          </View>

          {/* Expenses by Category */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>By Category</Text>
            {myExpensesByCategory.length === 0 ? (
              <View style={[styles.allSettledCard, { backgroundColor: colors.successLight }]}>
                <Text style={styles.allSettledIcon}>📊</Text>
                <Text style={[styles.allSettledText, { color: colors.success }]}>No expenses yet</Text>
                <Text style={[styles.allSettledSubtext, { color: colors.textSecondary }]}>Your share of expenses will appear here</Text>
              </View>
            ) : (
              myExpensesByCategory.map((cat) => (
                <View key={cat.category} style={[styles.categoryCard, { backgroundColor: colors.card }]}>
                  <View style={[styles.categoryIconContainer, { backgroundColor: colors.backgroundSecondary }]}>
                    <Text style={styles.categoryIcon}>{getCategoryIcon(cat.category)}</Text>
                  </View>
                  <View style={styles.categoryInfo}>
                    <Text style={[styles.categoryName, { color: colors.text }]}>{getCategoryLabel(cat.category)}</Text>
                    <Text style={[styles.categoryCount, { color: colors.textSecondary }]}>{cat.count} expense{cat.count !== 1 ? 's' : ''}</Text>
                  </View>
                  <Text style={[styles.categoryAmount, { color: colors.primary }]}>
                    {formatCurrency(cat.amount, currentGroup.currency)}
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* My Expense Details */}
          {groupExpenses.filter(e => e.splits.some(s => s.userId === currentUserId)).length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>My Expense Details</Text>
              {groupExpenses
                .filter(e => e.splits.some(s => s.userId === currentUserId))
                .map((expense) => {
                  const mySplit = expense.splits.find(s => s.userId === currentUserId);
                  return (
                    <View key={expense.id} style={[styles.myExpenseCard, { backgroundColor: colors.card }]}>
                      <View style={[styles.myExpenseIcon, { backgroundColor: colors.backgroundSecondary }]}>
                        <Text style={styles.myExpenseIconText}>{getCategoryIcon(expense.category || 'other')}</Text>
                      </View>
                      <View style={styles.myExpenseInfo}>
                        <Text style={[styles.myExpenseDescription, { color: colors.text }]}>{expense.description}</Text>
                        <Text style={[styles.myExpenseDate, { color: colors.textSecondary }]}>
                          {expense.date ? format(new Date(expense.date), 'MMM d') : ''} • Total: {formatCurrency(expense.amount, expense.currency)}
                        </Text>
                      </View>
                      <Text style={[styles.myExpenseAmount, { color: colors.text }]}>
                        {formatCurrency(mySplit?.amount || 0, expense.currency)}
                      </Text>
                    </View>
                  );
                })}
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView 
          style={[styles.content, { backgroundColor: colors.background }]} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
        >
          {/* Who Owes Who */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Who Owes Who</Text>
            {suggestedSettlements.length === 0 ? (
              <View style={[styles.allSettledCard, { backgroundColor: colors.successLight }]}>
                <Text style={styles.allSettledIcon}>✅</Text>
                <Text style={[styles.allSettledText, { color: colors.success }]}>All settled up!</Text>
                <Text style={[styles.allSettledSubtext, { color: colors.textSecondary }]}>No outstanding debts</Text>
              </View>
            ) : (
              suggestedSettlements.map((debt, index) => {
                const fromIndex = getMemberIndex(debt.from);
                const toIndex = getMemberIndex(debt.to);
                return (
                  <View key={index} style={[styles.debtCard, { backgroundColor: colors.card }]}>
                    <View style={styles.debtPeople}>
                      <Avatar 
                        name={getMemberName(debt.from)} 
                        index={fromIndex} 
                        size={32} 
                        userId={debt.from}
                        imageUri={getMemberAvatar(debt.from)}
                      />
                      <Text style={[styles.debtName, { color: colors.text }]}>{getMemberName(debt.from)}</Text>
                      <Text style={[styles.debtArrow, { color: colors.danger }]}>→</Text>
                      <Avatar 
                        name={getMemberName(debt.to)} 
                        index={toIndex} 
                        size={32} 
                        userId={debt.to}
                        imageUri={getMemberAvatar(debt.to)}
                      />
                      <Text style={[styles.debtName, { color: colors.text }]}>{getMemberName(debt.to)}</Text>
                    </View>
                    <Text style={[styles.debtAmount, { color: colors.danger }]}>
                      {formatCurrency(debt.amount, currentGroup.currency)}
                    </Text>
                  </View>
                );
              })
            )}
          </View>

          {/* Settlements - only show for debts the current user is involved in */}
          {mySettlements.length > 0 && (
            <View style={styles.section}>
              <View style={styles.settlementHeader}>
                <Text style={[styles.sectionTitle, { marginBottom: 0, color: colors.text }]}>Your Settlements</Text>
                <TouchableOpacity
                  style={[styles.smartSettleButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    const totalAmount = mySettlements.reduce((sum, s) => sum + s.amount, 0);
                    Alert.alert(
                      '⚡ Settle Your Debts',
                      `This will settle ${mySettlements.length} transaction${mySettlements.length > 1 ? 's' : ''} totaling ${formatCurrency(totalAmount, currentGroup.currency)}.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Settle All',
                          style: 'default',
                          onPress: async () => {
                            await Promise.all(mySettlements.map((settlement) =>
                              addSettlement({
                                groupId: currentGroup.id,
                                from: settlement.from,
                                to: settlement.to,
                                amount: settlement.amount,
                                currency: currentGroup.currency,
                                date: new Date().toISOString(),
                              })
                            ));
                            await fetchGroupData();
                            Alert.alert('✓ All Settled!', 'Your debts have been settled.');
                          },
                        },
                      ]
                    );
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.smartSettleButtonText}>⚡ Settle All</Text>
                </TouchableOpacity>
              </View>
              {mySettlements.map((settlement, index) => {
                const fromIndex = getMemberIndex(settlement.from);
                const toIndex = getMemberIndex(settlement.to);
                return (
                  <View key={index} style={[styles.settlementCard, { backgroundColor: colors.warningLight, borderLeftColor: colors.warning }]}>
                    <View style={styles.settlementPeople}>
                      <Avatar 
                        name={getMemberName(settlement.from)} 
                        index={fromIndex} 
                        size={36} 
                        userId={settlement.from}
                        imageUri={getMemberAvatar(settlement.from)}
                      />
                      <View style={styles.settlementArrow}>
                        <Text style={[styles.settlementArrowText, { color: colors.warning }]}>→</Text>
                      </View>
                      <Avatar 
                        name={getMemberName(settlement.to)} 
                        index={toIndex} 
                        size={36} 
                        userId={settlement.to}
                        imageUri={getMemberAvatar(settlement.to)}
                      />
                    </View>
                    <View style={styles.settlementInfo}>
                      <Text style={styles.settlementText}>
                        {getMemberName(settlement.from)} pays{' '}
                        {getMemberName(settlement.to)}
                      </Text>
                      <Text style={styles.settlementAmount}>
                        {formatCurrency(settlement.amount, currentGroup.currency)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.settleButton, { backgroundColor: colors.success }]}
                      onPress={() => {
                        Alert.alert(
                          'Settle Up',
                          `Mark ${getMemberName(settlement.from)} as having paid ${formatCurrency(settlement.amount, currentGroup.currency)} to ${getMemberName(settlement.to)}?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Confirm',
                              onPress: async () => {
                                await addSettlement({
                                  groupId: currentGroup.id,
                                  from: settlement.from,
                                  to: settlement.to,
                                  amount: settlement.amount,
                                  currency: currentGroup.currency,
                                  date: new Date().toISOString(),
                                });
                                await fetchGroupData();
                              },
                            },
                          ]
                        );
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.settleButtonText, { color: colors.textInverse }]}>Settle</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('AddExpense', { groupId: currentGroup.id })}
        activeOpacity={0.8}
      >
        <Text style={[styles.fabIcon, { color: colors.textInverse }]}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  summaryHeader: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 36,
    fontWeight: '600',
  },
  summarySubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: -10,
    borderRadius: 12,
    padding: 4,
    ...shadows.md,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
  },
  tabTextActive: {
  },
  content: {
    flex: 1,
    marginTop: 16,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  expenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    ...shadows.sm,
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  expenseAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expenseAvatarText: {
    fontSize: 16,
    fontWeight: '600',
  },
  expenseInfo: {
    marginLeft: 12,
    flex: 1,
  },
  expenseDescription: {
    fontSize: 16,
    fontWeight: '500',
  },
  expenseDetail: {
    fontSize: 13,
    marginTop: 2,
  },
  expenseRight: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  expenseDate: {
    fontSize: 12,
    marginTop: 2,
  },
  debtCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    ...shadows.sm,
  },
  debtPeople: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  debtAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  debtAvatarText: {
    fontSize: 13,
    fontWeight: '600',
  },
  debtName: {
    fontSize: 14,
    fontWeight: '400',
    marginHorizontal: 6,
  },
  debtArrow: {
    fontSize: 16,
    marginHorizontal: 4,
  },
  debtAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  allSettledCard: {
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  allSettledIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  allSettledText: {
    fontSize: 18,
    fontWeight: '600',
  },
  allSettledSubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    ...shadows.sm,
  },
  balanceAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceAvatarText: {
    fontSize: 14,
    fontWeight: '600',
  },
  balanceName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    marginLeft: 12,
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  positive: {
  },
  negative: {
  },
  settlementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  smartSettleButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  smartSettleButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  settlementCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  settlementPeople: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  settlementAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settlementAvatarText: {
    fontSize: 13,
    fontWeight: '600',
  },
  settlementArrow: {
    marginHorizontal: 12,
  },
  settlementArrowText: {
    fontSize: 18,
  },
  settlementInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settlementText: {
    fontSize: 14,
    color: '#92400e',
    flex: 1,
  },
  settlementAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#78350f',
  },
  settleButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 12,
    alignItems: 'center',
  },
  settleButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    padding: 16,
  },
  // My Expenses styles
  myTotalCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  myTotalLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  myTotalAmount: {
    fontSize: 36,
    fontWeight: '600',
  },
  myTotalSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
  },
  balanceSummaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  balanceSummaryCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  balanceSummaryLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  balanceSummaryAmount: {
    fontSize: 20,
    fontWeight: '600',
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    ...shadows.sm,
  },
  categoryIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryIcon: {
    fontSize: 22,
  },
  categoryInfo: {
    flex: 1,
    marginLeft: 12,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '500',
  },
  categoryCount: {
    fontSize: 13,
    marginTop: 2,
  },
  categoryAmount: {
    fontSize: 18,
    fontWeight: '600',
  },
  myExpenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    ...shadows.sm,
  },
  myExpenseIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  myExpenseIconText: {
    fontSize: 18,
  },
  myExpenseInfo: {
    flex: 1,
    marginLeft: 10,
  },
  myExpenseDescription: {
    fontSize: 15,
    fontWeight: '400',
  },
  myExpenseDate: {
    fontSize: 12,
    marginTop: 2,
  },
  myExpenseAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  fabIcon: {
    fontSize: 32,
    fontWeight: '400',
    marginTop: -2,
  },
});
