import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useSupabaseStore as useStore } from '../store/supabaseStore';
import { useAuth } from '../store/authContext';
import { Friend, FriendRequest } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { shadows } from '../theme/colors';
import Avatar from '../components/Avatar';

type NavigationProp = StackNavigationProp<RootStackParamList>;

export default function FriendsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { friends, friendRequests, deleteFriend, acceptFriendRequest, rejectFriendRequest, loadData } = useStore();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Filter incoming requests (sent TO me)
  const incomingRequests = friendRequests.filter(r => r.toUser === user?.id && r.status === 'pending');
  // Filter outgoing requests (sent BY me)
  const outgoingRequests = friendRequests.filter(r => r.fromUser === user?.id && r.status === 'pending');

  const handleDeleteFriend = (friend: Friend) => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove @${friend.username} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => deleteFriend(friend.id),
        },
      ]
    );
  };

  const handleAcceptRequest = async (request: FriendRequest) => {
    setProcessingRequest(request.id);
    try {
      await acceptFriendRequest(request.id, request.fromUser);
      Alert.alert('Friend Added! 🎉', `You and @${request.fromUsername} are now friends!`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to accept request');
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleRejectRequest = async (request: FriendRequest) => {
    Alert.alert(
      'Decline Request',
      `Decline friend request from @${request.fromUsername}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setProcessingRequest(request.id);
            try {
              await rejectFriendRequest(request.id);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to decline request');
            } finally {
              setProcessingRequest(null);
            }
          },
        },
      ]
    );
  };

  const renderRequestCard = ({ item, index }: { item: FriendRequest; index: number }) => {
    const isProcessing = processingRequest === item.id;
    const isIncoming = item.toUser === user?.id;
    
    return (
      <View style={[styles.requestCard, { backgroundColor: colors.card }]}>
        <View style={styles.cardContent}>
          <Avatar
            name={isIncoming ? item.fromUsername || '?' : item.toUsername || '?'}
            index={index}
            size={48}
            userId={isIncoming ? item.fromUser : item.toUser}
            imageUri={isIncoming ? item.fromAvatar : item.toAvatar}
          />
          <View style={styles.friendInfo}>
            <Text style={[styles.friendName, { color: colors.text }]}>
              @{isIncoming ? item.fromUsername : item.toUsername}
            </Text>
            <Text style={[styles.requestStatus, { color: colors.textSecondary }]}>
              {isIncoming ? 'Wants to be your friend' : 'Request pending...'}
            </Text>
          </View>
        </View>
        
        {isIncoming && (
          <View style={styles.requestActions}>
            {isProcessing ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.acceptButton, { backgroundColor: colors.success }]}
                  onPress={() => handleAcceptRequest(item)}
                >
                  <Text style={styles.actionButtonText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.rejectButton, { backgroundColor: colors.dangerLight }]}
                  onPress={() => handleRejectRequest(item)}
                >
                  <Text style={[styles.rejectButtonText, { color: colors.danger }]}>Decline</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderFriendCard = ({ item, index }: { item: Friend; index: number }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={() => {}}
      onLongPress={() => handleDeleteFriend(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardContent}>
        <Avatar
          name={item.username}
          index={index}
          size={48}
          userId={item.friendId}
          imageUri={item.avatar}
        />
        <View style={styles.friendInfo}>
          <Text style={[styles.friendName, { color: colors.text }]}>@{item.username}</Text>
          {item.email && <Text style={[styles.friendEmail, { color: colors.textSecondary }]}>{item.email}</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <ScrollView
      contentContainerStyle={[styles.emptyState, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight + '20' }]}>
        <Text style={styles.emptyIconText}>👥</Text>
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No Friends Yet</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Add friends to easily split expenses{'\n'}with them in your groups
      </Text>
      <Text style={[styles.pullToRefresh, { color: colors.textMuted }]}>
        Pull down to refresh
      </Text>
      <TouchableOpacity
        style={[styles.emptyButton, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('AddFriend')}
      >
        <Text style={[styles.emptyButtonText, { color: colors.textInverse }]}>Add Your First Friend</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const hasContent = friends.length > 0 || incomingRequests.length > 0 || outgoingRequests.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.primary }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.primary }]} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <View style={styles.headerContent}>
            <Text style={[styles.headerTitle, { color: colors.textInverse }]}>Friends</Text>
            <View style={styles.headerBadges}>
              {incomingRequests.length > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                  <Text style={styles.badgeText}>{incomingRequests.length}</Text>
                </View>
              )}
              <Text style={[styles.headerSubtitle, { color: colors.textInverse }]}>
                {friends.length} {friends.length === 1 ? 'friend' : 'friends'}
              </Text>
            </View>
          </View>
        </View>

        {!hasContent ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={[]}
            renderItem={() => null}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            ListHeaderComponent={
              <>
                {/* Incoming Friend Requests */}
                {incomingRequests.length > 0 && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      📩 Friend Requests ({incomingRequests.length})
                    </Text>
                    {incomingRequests.map((request, index) => (
                      <View key={request.id}>
                        {renderRequestCard({ item: request, index })}
                      </View>
                    ))}
                  </View>
                )}

                {/* Outgoing Requests */}
                {outgoingRequests.length > 0 && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      📤 Pending Requests ({outgoingRequests.length})
                    </Text>
                    {outgoingRequests.map((request, index) => (
                      <View key={request.id}>
                        {renderRequestCard({ item: request, index })}
                      </View>
                    ))}
                  </View>
                )}

                {/* Friends List */}
                {friends.length > 0 && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      👥 Your Friends ({friends.length})
                    </Text>
                    {friends.map((friend, index) => (
                      <View key={friend.id}>
                        {renderFriendCard({ item: friend, index })}
                      </View>
                    ))}
                  </View>
                )}
              </>
            }
            contentContainerStyle={[styles.listContent, { backgroundColor: colors.background }]}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* FAB */}
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('AddFriend')}
          activeOpacity={0.8}
        >
          <Text style={[styles.fabIcon, { color: colors.textInverse }]}>+</Text>
        </TouchableOpacity>
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
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
    ...shadows.md,
  },
  requestCard: {
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
    ...shadows.md,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendInfo: {
    marginLeft: 14,
    flex: 1,
  },
  friendName: {
    fontSize: 17,
    fontWeight: '500',
    marginBottom: 2,
  },
  friendEmail: {
    fontSize: 14,
  },
  requestStatus: {
    fontSize: 13,
  },
  requestActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
  },
  acceptButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  rejectButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 14,
  },
  rejectButtonText: {
    fontWeight: '500',
    fontSize: 14,
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
    marginBottom: 16,
  },
  pullToRefresh: {
    fontSize: 13,
    marginBottom: 24,
  },
  emptyButton: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 25,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  fabIcon: {
    fontSize: 32,
    fontWeight: '300',
    marginTop: -2,
  },
});
