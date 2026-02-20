import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useSupabaseStore as useStore } from '../store/supabaseStore';
import { useAuth } from '../store/authContext';
import { Group } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { shadows } from '../theme/colors';
import { formatCurrency } from '../lib/utils';
import Avatar from '../components/Avatar';

type NavigationProp = StackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { groups, isLoading, loadData, lastUpdated, subscribeToGroups } = useStore();
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';
  const { colors, isDark } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const getAvatarColor = (index: number) => {
    return colors.avatarColors[index % colors.avatarColors.length];
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToGroups();
    return () => unsubscribe();
  }, []);

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const renderGroupCard = ({ item, index }: { item: Group; index: number }) => {
    const totalSpent = item.totalSpent || 0;
    const expenseCount = item.expenseCount || 0;

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card }]}
        onPress={() => navigation.navigate('GroupDetail', { group: item })}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          {item.imageUri ? (
            <Image source={{ uri: item.imageUri }} style={styles.groupIcon} />
          ) : (
            <View style={[styles.groupIcon, { backgroundColor: getAvatarColor(index) }]}>
              <Text style={[styles.groupIconText, { color: colors.textInverse }]}>{item.name[0].toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.cardTitleContainer}>
            <Text style={[styles.groupName, { color: colors.text }]}>{item.name}</Text>
            {item.description && (
              <Text style={[styles.groupDescription, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.description}
              </Text>
            )}
          </View>
          <View style={[styles.chevron, { backgroundColor: colors.backgroundSecondary }]}>
            <Text style={[styles.chevronText, { color: colors.textSecondary }]}>›</Text>
          </View>
        </View>

        <View style={[styles.cardDivider, { backgroundColor: colors.borderLight }]} />

        <View style={styles.cardFooter}>
          <View style={styles.memberAvatars}>
            {(item.members || []).slice(0, 4).map((member, idx) => (
              <View
                key={member.id}
                style={[styles.memberAvatarWrapper, { marginLeft: idx > 0 ? -10 : 0, borderColor: colors.card }]}
              >
                <Avatar name={member.username} index={idx} size={28} userId={member.id} imageUri={member.avatar} />
              </View>
            ))}
            {(item.members || []).length > 4 && (
              <View style={[styles.memberAvatarWrapper, { marginLeft: -10, borderColor: colors.card }]}>
                <View style={[styles.moreMembers, { backgroundColor: colors.backgroundSecondary }]}>
                  <Text style={[styles.moreMembersText, { color: colors.textSecondary }]}>+{(item.members || []).length - 4}</Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.text }]}>{expenseCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>expenses</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.borderLight }]} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {formatCurrency(totalSpent, item.currency)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>total</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Only show loading on initial load when we have no data
  if (isLoading && groups.length === 0) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      
      <SafeAreaView style={[styles.headerSafeArea, { backgroundColor: colors.primary }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <Text style={[styles.headerTitle, { color: colors.textInverse }]}>Splitly</Text>
          <Text style={styles.headerSubtitle}>Split expenses with friends</Text>
        </View>
      </SafeAreaView>

      {groups.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.backgroundSecondary }]}>
            <Text style={styles.emptyIconText}>👥</Text>
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No groups yet</Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            Create a group to start splitting expenses with friends
          </Text>
          <TouchableOpacity
            style={[styles.emptyButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('AddGroup')}
          >
            <Text style={[styles.emptyButtonText, { color: colors.textInverse }]}>Create Your First Group</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.joinButton, { borderColor: colors.primary }]}
            onPress={() => navigation.navigate('JoinGroup')}
          >
            <Text style={[styles.joinButtonText, { color: colors.primary }]}>Join with Invite Code</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          key={`groups-${groups.length}`}
          data={groups}
          extraData={lastUpdated}
          renderItem={renderGroupCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
        />
      )}

      {groups.length > 0 && (
        <View style={styles.fabContainer}>
          <TouchableOpacity
            style={[styles.fabSecondary, { backgroundColor: colors.card, borderColor: colors.primary }]}
            onPress={() => navigation.navigate('JoinGroup')}
            activeOpacity={0.8}
          >
            <Text style={styles.fabSecondaryIcon}>🔗</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('AddGroup')}
            activeOpacity={0.8}
          >
            <Text style={[styles.fabIcon, { color: colors.textInverse }]}>+</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerSafeArea: {
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    borderRadius: 16,
    marginBottom: 16,
    ...shadows.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  groupIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupIconText: {
    fontSize: 22,
    fontWeight: '600',
  },
  cardTitleContainer: {
    flex: 1,
    marginLeft: 14,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '500',
  },
  groupDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronText: {
    fontSize: 20,
    fontWeight: '500',
  },
  cardDivider: {
    height: 1,
    marginHorizontal: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  memberAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatarWrapper: {
    borderWidth: 2,
    borderRadius: 16,
  },
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontWeight: '500',
  },
  moreMembers: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreMembersText: {
    fontSize: 11,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    alignItems: 'flex-end',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 24,
    marginHorizontal: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyIconText: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyButton: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    ...shadows.md,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  joinButton: {
    marginTop: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
  },
  joinButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  fabContainer: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  fabSecondary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    ...shadows.md,
  },
  fabSecondaryIcon: {
    fontSize: 20,
  },
  fab: {
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
