import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSupabaseStore as useStore } from '../store/supabaseStore';
import { Expense, Settlement } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { shadows } from '../theme/colors';
import { formatCurrency } from '../lib/utils';
import { format } from 'date-fns';

interface ActivityItem {
  id: string;
  type: 'expense' | 'settlement';
  date: string;
  groupName: string;
  description: string;
  amount: number;
  currency: string;
  icon: string;
  color: string;
}

const categoryIcons: Record<string, string> = {
  food: '🍔',
  transport: '🚗',
  accommodation: '🏠',
  entertainment: '🎬',
  shopping: '🛍️',
  utilities: '💡',
  other: '📦',
};

export default function ActivityScreen() {
  const { groups, expenses, settlements } = useStore();
  const { colors, isDark } = useTheme();

  const getAvatarColor = (index: number) => {
    return colors.avatarColors[index % colors.avatarColors.length];
  };

  // Combine and sort all activities
  const activities: ActivityItem[] = [
    ...expenses.map((expense) => {
      const group = groups.find((g) => g.id === expense.groupId);
      const paidByMember = group?.members.find((m) => m.id === expense.paidBy);
      return {
        id: expense.id,
        type: 'expense' as const,
        date: expense.createdAt || expense.date,
        groupName: group?.name || 'Unknown Group',
        description: `${paidByMember?.username || 'Someone'} added: ${expense.description}`,
        amount: expense.amount,
        currency: expense.currency,
        icon: categoryIcons[expense.category || 'other'] || '📦',
        color: colors.danger,
      };
    }),
    ...settlements.map((settlement) => {
      const group = groups.find((g) => g.id === settlement.groupId);
      const fromMember = group?.members.find((m) => m.id === settlement.from);
      const toMember = group?.members.find((m) => m.id === settlement.to);
      return {
        id: settlement.id,
        type: 'settlement' as const,
        date: settlement.createdAt || settlement.date,
        groupName: group?.name || 'Unknown Group',
        description: `${fromMember?.username || 'Someone'} paid ${toMember?.username || 'someone'}`,
        amount: settlement.amount,
        currency: settlement.currency,
        icon: '💸',
        color: colors.success,
      };
    }),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Unknown date';
      
      const now = new Date();
      const diffTime = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      
      return format(date, 'MMM d, yyyy');
    } catch {
      return 'Unknown date';
    }
  };

  const renderActivityCard = ({ item, index }: { item: ActivityItem; index: number }) => (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.cardLeft}>
        <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
          <Text style={styles.icon}>{item.icon}</Text>
        </View>
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={[styles.description, { color: colors.text }]} numberOfLines={1}>
            {item.description}
          </Text>
          <Text style={[styles.amount, { color: item.type === 'settlement' ? colors.success : colors.text }]}>
            {item.type === 'settlement' ? '+' : ''}{formatCurrency(item.amount, item.currency as any)}
          </Text>
        </View>
        <View style={styles.cardFooter}>
          <View style={[styles.groupBadge, { backgroundColor: colors.primaryLight + '20' }]}>
            <Text style={[styles.groupName, { color: colors.primary }]}>{item.groupName}</Text>
          </View>
          <Text style={[styles.date, { color: colors.textMuted }]}>{formatDate(item.date)}</Text>
        </View>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={[styles.emptyState, { backgroundColor: colors.background }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight + '20' }]}>
        <Text style={styles.emptyIconText}>📋</Text>
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No Activity Yet</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        When you add expenses or settle up,{'\n'}they'll appear here
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.primary }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.primary }]} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <View style={styles.headerContent}>
            <Text style={[styles.headerTitle, { color: colors.textInverse }]}>Activity</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textInverse }]}>
              {activities.length} {activities.length === 1 ? 'event' : 'events'}
            </Text>
          </View>
        </View>

        {/* Activity List */}
        {activities.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={activities}
            renderItem={renderActivityCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.listContent, { backgroundColor: colors.background }]}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.8,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
    flexGrow: 1,
  },
  card: {
    flexDirection: 'row',
    borderRadius: 14,
    marginBottom: 10,
    padding: 14,
    ...shadows.sm,
  },
  cardLeft: {
    marginRight: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 22,
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  description: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    marginRight: 10,
  },
  amount: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  groupBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  groupName: {
    fontSize: 12,
    fontWeight: '500',
  },
  date: {
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyIconText: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
