import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useSupabaseStore as useStore } from '../store/supabaseStore';
import { useAuth } from '../store/authContext';
import { useTheme } from '../theme/ThemeContext';
import { shadows } from '../theme/colors';
import { supabase } from '../lib/supabase';
import Avatar from '../components/Avatar';

type AddFriendScreenNavigationProp = StackNavigationProp<RootStackParamList, 'AddFriend'>;

interface Props {
  navigation: AddFriendScreenNavigationProp;
}

interface SearchResult {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
}

export default function AddFriendScreen({ navigation }: Props) {
  const { sendFriendRequest, friends, friendRequests } = useStore();
  const { profile } = useAuth();
  const { colors, isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Error', 'Please enter a username to search');
      return;
    }

    // Can't add yourself
    if (searchQuery.trim().toLowerCase() === profile?.username?.toLowerCase()) {
      Alert.alert('Error', "You can't add yourself as a friend");
      return;
    }

    setSearching(true);
    setSearchResult(null);
    setNotFound(false);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, email, avatar_url')
        .ilike('username', searchQuery.trim())
        .single();

      if (error || !data) {
        setNotFound(true);
      } else {
        // Check if already a friend
        const alreadyFriend = friends.some(f => f.friendId === data.id);
        if (alreadyFriend) {
          Alert.alert('Already Friends', `@${data.username} is already in your friends list`);
          setSearchQuery('');
          return;
        }
        
        // Check if request already exists
        const existingRequest = friendRequests.find(
          r => (r.fromUser === profile?.id && r.toUser === data.id) ||
               (r.fromUser === data.id && r.toUser === profile?.id)
        );
        if (existingRequest) {
          if (existingRequest.fromUser === data.id) {
            Alert.alert('Pending Request', `@${data.username} has already sent you a friend request! Check your friend requests.`);
          } else {
            Alert.alert('Request Pending', `You already sent a friend request to @${data.username}`);
          }
          setSearchQuery('');
          return;
        }
        
        setSearchResult(data);
      }
    } catch (error) {
      console.error('Search error:', error);
      setNotFound(true);
    } finally {
      setSearching(false);
    }
  };

  const handleAddFriend = async () => {
    if (!searchResult) return;

    setAdding(true);
    try {
      await sendFriendRequest(searchResult.id);
      Alert.alert(
        'Request Sent! 📤', 
        `A friend request has been sent to @${searchResult.username}. They need to accept it to become friends.`, 
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send friend request');
    } finally {
      setAdding(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={[styles.scrollView, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search Section */}
        <View style={styles.searchSection}>
          <Text style={[styles.title, { color: colors.text }]}>Find Friends</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Search by username to add friends
          </Text>

          <View style={styles.searchContainer}>
            <View style={[styles.searchInputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.atSymbol, { color: colors.textMuted }]}>@</Text>
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Enter username"
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
            </View>
            <TouchableOpacity
              style={[styles.searchButton, { backgroundColor: colors.primary }]}
              onPress={handleSearch}
              disabled={searching || !searchQuery.trim()}
              activeOpacity={0.8}
            >
              {searching ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.searchButtonText}>🔍</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Result */}
        {searchResult && (
          <View style={[styles.resultCard, { backgroundColor: colors.card }]}>
            <View style={styles.resultHeader}>
              <Avatar
                name={searchResult.username}
                index={0}
                size={60}
                userId={searchResult.id}
                imageUri={searchResult.avatar_url}
              />
              <View style={styles.resultInfo}>
                <Text style={[styles.resultUsername, { color: colors.text }]}>@{searchResult.username}</Text>
                <Text style={[styles.resultEmail, { color: colors.textSecondary }]}>{searchResult.email}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={handleAddFriend}
              disabled={adding}
              activeOpacity={0.8}
            >
              {adding ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={[styles.addButtonText, { color: colors.textInverse }]}>Send Friend Request</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Not Found */}
        {notFound && (
          <View style={[styles.notFoundCard, { backgroundColor: colors.card }]}>
            <Text style={styles.notFoundIcon}>😕</Text>
            <Text style={[styles.notFoundTitle, { color: colors.text }]}>User not found</Text>
            <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>
              No user with username "@{searchQuery.trim()}" exists. Make sure you typed it correctly.
            </Text>
          </View>
        )}

        {/* Info Card */}
        {!searchResult && !notFound && (
          <View style={[styles.infoCard, { backgroundColor: colors.primaryLight + '20' }]}>
            <Text style={styles.infoIcon}>💡</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Ask your friends for their username to add them. Usernames are unique and case-insensitive.
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  searchSection: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '500',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  atSymbol: {
    fontSize: 18,
    fontWeight: '500',
    marginRight: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
  },
  searchButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  searchButtonText: {
    fontSize: 20,
  },
  resultCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    ...shadows.sm,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultInfo: {
    marginLeft: 16,
    flex: 1,
  },
  resultUsername: {
    fontSize: 20,
    fontWeight: '500',
    marginBottom: 4,
  },
  resultEmail: {
    fontSize: 14,
  },
  addButton: {
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    ...shadows.sm,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  notFoundCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    ...shadows.sm,
  },
  notFoundIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 8,
  },
  notFoundText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  infoCard: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    alignItems: 'flex-start',
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
