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
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useSupabaseStore as useStore } from '../store/supabaseStore';
import { useAuth } from '../store/authContext';
import { api } from '../lib/api';
import { User, Currency, Friend } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { shadows } from '../theme/colors';
import InviteCodeModal from '../components/InviteCodeModal';
import * as ImagePicker from 'expo-image-picker';

type AddGroupScreenNavigationProp = StackNavigationProp<RootStackParamList, 'AddGroup'>;

interface Props {
  navigation: AddGroupScreenNavigationProp;
}

const currencies: { value: Currency; label: string; symbol: string }[] = [
  { value: 'USD', label: 'US Dollar', symbol: '$' },
  { value: 'EUR', label: 'Euro', symbol: '€' },
  { value: 'GBP', label: 'British Pound', symbol: '£' },
  { value: 'INR', label: 'Indian Rupee', symbol: '₹' },
  { value: 'CAD', label: 'Canadian Dollar', symbol: 'C$' },
  { value: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
];

export default function AddGroupScreen({ navigation }: Props) {
  const { addGroup, friends, addMemberToGroup } = useStore();
  const { user, profile } = useAuth();
  const { colors, isDark } = useTheme();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [groupImage, setGroupImage] = useState<string | undefined>(undefined);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const getAvatarColor = (index: number) => {
    return colors.avatarColors[index % colors.avatarColors.length];
  };
  
  // Selected friends to add as members (not including yourself - you're added automatically)
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [currency, setCurrency] = useState<Currency>('USD');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [createdInviteCode, setCreatedInviteCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search to add members by username/email
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearching, setMemberSearching] = useState(false);
  const [memberSearchResult, setMemberSearchResult] = useState<{ id: string; name: string; email: string; avatar_url?: string } | null>(null);
  const [memberSearchNotFound, setMemberSearchNotFound] = useState(false);
  const [pendingMembers, setPendingMembers] = useState<{ id: string; name: string; email: string }[]>([]);

  const handleToggleFriend = (friendId: string) => {
    if (selectedFriendIds.includes(friendId)) {
      setSelectedFriendIds(selectedFriendIds.filter(id => id !== friendId));
    } else {
      setSelectedFriendIds([...selectedFriendIds, friendId]);
    }
  };

  const handleSearchMember = async () => {
    const query = memberSearch.trim();
    if (!query) return;

    if (query.toLowerCase() === profile?.username?.toLowerCase()) {
      Alert.alert('Cannot add yourself', "You are already the group creator.");
      return;
    }

    setMemberSearching(true);
    setMemberSearchResult(null);
    setMemberSearchNotFound(false);

    try {
      const response = await api.searchUsers(query);
      if (!response.user) {
        setMemberSearchNotFound(true);
      } else {
        const data = response.user;
        // Already in pending or already a selected friend
        if (pendingMembers.some(m => m.id === data.id)) {
          Alert.alert('Already added', `@${data.name} is already in the list.`);
          setMemberSearch('');
          return;
        }
        setMemberSearchResult(data);
      }
    } catch {
      setMemberSearchNotFound(true);
    } finally {
      setMemberSearching(false);
    }
  };

  const handleAddPendingMember = () => {
    if (!memberSearchResult) return;
    setPendingMembers(prev => [...prev, {
      id: memberSearchResult.id,
      name: memberSearchResult.name,
      email: memberSearchResult.email,
    }]);
    setMemberSearchResult(null);
    setMemberSearch('');
  };

  const handleRemovePendingMember = (id: string) => {
    setPendingMembers(prev => prev.filter(m => m.id !== id));
  };

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Please allow access to your photo library to set a group picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0]) {
      const localUri = result.assets[0].uri;
      setGroupImage(localUri);
      setUploadingImage(true);
      try {
        const uploadResponse = await api.uploadImage(localUri);
        setGroupImage(api.getFullUrl(uploadResponse.url));
      } catch (error) {
        Alert.alert('Error', 'Failed to upload image. Please try again.');
        setGroupImage(undefined);
      } finally {
        setUploadingImage(false);
      }
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Missing Information', 'Please enter a group name');
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      console.log('🚀 Starting group creation...');
      console.log('📝 Group data:', { name: name.trim(), description: description.trim(), currency, selectedFriends: selectedFriendIds.length });
      
      // Create group - you are automatically added as a member
      const createdGroup = await addGroup({
        name: name.trim(),
        description: description.trim(),
        imageUri: groupImage,
        members: [], // Members are added via the store/database
        currency,
      });

      console.log('✅ Group created:', createdGroup);

      // Add selected friends as members
      if (selectedFriendIds.length > 0) {
        console.log('👥 Adding selected friends to group...');

        for (const friendId of selectedFriendIds) {
          const friend = friends.find(f => f.id === friendId);
          if (friend) {
            try {
              await addMemberToGroup(createdGroup.id, { id: friend.friendId } as any);
              console.log(`✅ Added friend ${friend.username} to group`);
            } catch (err) {
              console.error(`Failed to add friend ${friend.username}:`, err);
            }
          }
        }
      }

      // Add pending members found via search
      if (pendingMembers.length > 0) {
        console.log('👥 Adding searched members to group...');
        for (const member of pendingMembers) {
          try {
            await addMemberToGroup(createdGroup.id, { id: member.id } as any);
            console.log(`✅ Added member ${member.name} to group`);
          } catch (err) {
            console.error(`Failed to add member ${member.name}:`, err);
          }
        }
      }

      setCreatedInviteCode(createdGroup.inviteCode);
      setShowInviteModal(true);
    } catch (error: any) {
      console.error('❌ Error creating group:', error);
      console.error('❌ Error message:', error?.message);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      Alert.alert('Error', `Failed to create group: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseInviteModal = () => {
    setShowInviteModal(false);
    navigation.goBack();
  };

  const selectedCurrency = currencies.find((c) => c.value === currency);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <InviteCodeModal
        visible={showInviteModal}
        inviteCode={createdInviteCode}
        groupName={name.trim()}
        onClose={handleCloseInviteModal}
      />
      <ScrollView
        style={[styles.scrollView, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Group Name */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Group Details</Text>
          
          {/* Group Image Picker */}
          <TouchableOpacity
            style={[styles.imagePickerCard, { backgroundColor: colors.card }]}
            onPress={handlePickImage}
            activeOpacity={0.7}
            disabled={uploadingImage}
          >
            {groupImage ? (
              <Image source={{ uri: groupImage }} style={styles.groupImagePreview} />
            ) : (
              <View style={[styles.imagePlaceholder, { backgroundColor: colors.backgroundSecondary }]}>
                <Text style={styles.imagePlaceholderIcon}>📷</Text>
              </View>
            )}
            {uploadingImage ? (
              <View style={[styles.imageEditBadge, { backgroundColor: colors.primary }]}>
                <ActivityIndicator size="small" color={colors.textInverse} />
              </View>
            ) : (
              <View style={[styles.imageEditBadge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.imageEditBadgeText, { color: colors.textInverse }]}>
                  {groupImage ? '✏️' : '+'}
                </Text>
              </View>
            )}
            {!groupImage && !uploadingImage && (
              <Text style={[styles.imagePlaceholderText, { color: colors.textSecondary }]}>Add Group Photo</Text>
            )}
            {uploadingImage && (
              <Text style={[styles.imagePlaceholderText, { color: colors.textSecondary }]}>Uploading...</Text>
            )}
          </TouchableOpacity>

          <View style={[styles.inputCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Group Name</Text>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={name}
              onChangeText={setName}
              placeholder="e.g., Trip to Paris, Roommates"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={[styles.inputCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Description (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea, { color: colors.text }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Add some details about this group..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Currency Picker */}
          <TouchableOpacity
            style={[styles.inputCard, { backgroundColor: colors.card }]}
            onPress={() => setShowCurrencyPicker(!showCurrencyPicker)}
            activeOpacity={0.7}
          >
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Currency</Text>
            <View style={styles.currencyDisplay}>
              <Text style={[styles.currencySymbol, { color: colors.primary }]}>{selectedCurrency?.symbol}</Text>
              <Text style={[styles.currencyLabel, { color: colors.text }]}>{selectedCurrency?.label}</Text>
              <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
            </View>
          </TouchableOpacity>

          {showCurrencyPicker && (
            <View style={[styles.currencyPicker, { backgroundColor: colors.card }]}>
              {currencies.map((curr) => (
                <TouchableOpacity
                  key={curr.value}
                  style={[
                    styles.currencyOption,
                    { borderBottomColor: colors.border },
                    currency === curr.value && [styles.currencyOptionSelected, { backgroundColor: colors.primaryLight + '20' }],
                  ]}
                  onPress={() => {
                    setCurrency(curr.value);
                    setShowCurrencyPicker(false);
                  }}
                >
                  <Text style={[styles.currencyOptionSymbol, { color: colors.primary }]}>{curr.symbol}</Text>
                  <Text
                    style={[
                      styles.currencyOptionLabel,
                      { color: colors.text },
                      currency === curr.value && [styles.currencyOptionLabelSelected, { color: colors.primary }],
                    ]}
                  >
                    {curr.label}
                  </Text>
                  {currency === curr.value && (
                    <Text style={[styles.checkmark, { color: colors.primary }]}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Members */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Members</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Select friends to add to this group. You are automatically included.
          </Text>

          {/* Select from Friends */}
          {friends.length > 0 && (
            <View style={[styles.friendsList, { backgroundColor: colors.card }]}>
              {friends.map((friend, index) => {
                const isSelected = selectedFriendIds.includes(friend.id);
                return (
                  <TouchableOpacity
                    key={friend.id}
                    style={[
                      styles.friendItem,
                      { borderBottomColor: colors.border },
                      isSelected && styles.friendItemAdded,
                    ]}
                    onPress={() => handleToggleFriend(friend.id)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.friendAvatar,
                        { backgroundColor: getAvatarColor(index) },
                      ]}
                    >
                      <Text style={[styles.friendAvatarText, { color: colors.textInverse }]}>
                        {friend.username[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.friendInfo}>
                      <Text style={[styles.friendName, { color: colors.text }]}>{friend.username}</Text>
                      {friend.email && (
                        <Text style={[styles.friendEmail, { color: colors.textSecondary }]}>{friend.email}</Text>
                      )}
                    </View>
                    {isSelected ? (
                      <View style={[styles.addedBadge, { backgroundColor: colors.successLight }]}>
                        <Text style={[styles.addedBadgeText, { color: colors.success }]}>✓ Selected</Text>
                      </View>
                    ) : (
                      <View style={[styles.addFriendButton, { backgroundColor: colors.primary }]}>
                        <Text style={[styles.addFriendButtonText, { color: colors.textInverse }]}>+ Add</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* OR divider when friends exist */}
          {friends.length > 0 && (
            <View style={styles.orDivider}>
              <View style={[styles.orLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.orText, { color: colors.textMuted }]}>or add by username</Text>
              <View style={[styles.orLine, { backgroundColor: colors.border }]} />
            </View>
          )}

          {/* Search by username / email */}
          <View style={[styles.searchMemberCard, { backgroundColor: colors.card }]}>
            {friends.length === 0 && (
              <Text style={[styles.searchMemberHint, { color: colors.textSecondary }]}>
                Search for people by their username or email to add them to this group.
              </Text>
            )}
            <View style={styles.searchMemberRow}>
              <TextInput
                style={[styles.searchMemberInput, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                placeholder="Username or email..."
                placeholderTextColor={colors.textMuted}
                value={memberSearch}
                onChangeText={text => {
                  setMemberSearch(text);
                  setMemberSearchResult(null);
                  setMemberSearchNotFound(false);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={handleSearchMember}
                returnKeyType="search"
              />
              <TouchableOpacity
                style={[styles.searchMemberButton, { backgroundColor: colors.primary }]}
                onPress={handleSearchMember}
                disabled={memberSearching || !memberSearch.trim()}
                activeOpacity={0.8}
              >
                {memberSearching ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.searchMemberButtonText}>🔍</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Search result */}
            {memberSearchResult && (
              <View style={[styles.searchResultRow, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                <View style={[styles.searchResultAvatar, { backgroundColor: getAvatarColor(0) }]}>
                  <Text style={[styles.friendAvatarText, { color: colors.textInverse }]}>
                    {memberSearchResult.name[0].toUpperCase()}
                  </Text>
                </View>
                <View style={styles.searchResultInfo}>
                  <Text style={[styles.friendName, { color: colors.text }]}>@{memberSearchResult.name}</Text>
                  <Text style={[styles.friendEmail, { color: colors.textSecondary }]}>{memberSearchResult.email}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.addFriendButton, { backgroundColor: colors.success }]}
                  onPress={handleAddPendingMember}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.addFriendButtonText, { color: colors.textInverse }]}>+ Add</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Not found */}
            {memberSearchNotFound && (
              <Text style={[styles.searchNotFound, { color: colors.danger }]}>
                No user found for "{memberSearch.trim()}"
              </Text>
            )}
          </View>

          {/* Pending members added via search */}
          {pendingMembers.length > 0 && (
            <View style={[styles.pendingMembersList, { backgroundColor: colors.card }]}>
              <Text style={[styles.pendingMembersLabel, { color: colors.textSecondary }]}>Added via search:</Text>
              {pendingMembers.map(member => (
                <View key={member.id} style={[styles.friendItem, { borderBottomColor: colors.border }]}>
                  <View style={[styles.friendAvatar, { backgroundColor: getAvatarColor(1) }]}>
                    <Text style={[styles.friendAvatarText, { color: colors.textInverse }]}>
                      {member.name[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.friendInfo}>
                    <Text style={[styles.friendName, { color: colors.text }]}>@{member.name}</Text>
                    <Text style={[styles.friendEmail, { color: colors.textSecondary }]}>{member.email}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.removePendingButton, { backgroundColor: colors.dangerLight }]}
                    onPress={() => handleRemovePendingMember(member.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.removePendingText, { color: colors.danger }]}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Selected count */}
          {(selectedFriendIds.length > 0 || pendingMembers.length > 0) && (
            <View style={[styles.selectedCount, { backgroundColor: colors.primaryLight + '20' }]}>
              <Text style={[styles.selectedCountText, { color: colors.primary }]}>
                {selectedFriendIds.length + pendingMembers.length} member{(selectedFriendIds.length + pendingMembers.length) !== 1 ? 's' : ''} selected + you
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: colors.primary },
            (!name.trim() || uploadingImage || isSubmitting) && [styles.saveButtonDisabled, { opacity: 0.5 }],
          ]}
          onPress={handleSave}
          disabled={!name.trim() || uploadingImage || isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={[styles.saveButtonText, { color: colors.textInverse }]}>Create Group</Text>
          )}
        </TouchableOpacity>
      </View>
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
    paddingBottom: 120,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  imagePickerCard: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    position: 'relative',
    ...shadows.sm,
  },
  groupImagePreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  imagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderIcon: {
    fontSize: 32,
  },
  imagePlaceholderText: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 8,
  },
  imageEditBadge: {
    position: 'absolute',
    top: 85,
    right: '32%',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageEditBadgeText: {
    fontSize: 14,
  },
  inputCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...shadows.sm,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    fontSize: 16,
    padding: 0,
  },
  textArea: {
    height: 60,
  },
  currencyDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '600',
    marginRight: 8,
  },
  currencyLabel: {
    fontSize: 16,
    flex: 1,
  },
  chevron: {
    fontSize: 20,
  },
  currencyPicker: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    ...shadows.sm,
  },
  currencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  currencyOptionSelected: {
  },
  currencyOptionSymbol: {
    fontSize: 18,
    fontWeight: '500',
    width: 40,
  },
  currencyOptionLabel: {
    fontSize: 16,
    flex: 1,
  },
  currencyOptionLabelSelected: {
    fontWeight: '500',
  },
  checkmark: {
    fontSize: 18,
    fontWeight: '600',
  },
  addMemberCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...shadows.sm,
  },
  addMemberInputs: {
    marginBottom: 12,
  },
  memberNameInput: {
    fontSize: 16,
    borderBottomWidth: 1,
    paddingVertical: 12,
    marginBottom: 8,
  },
  memberEmailInput: {
    fontSize: 16,
    paddingVertical: 12,
  },
  addMemberButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addMemberButtonDisabled: {
  },
  addMemberButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  membersList: {
    marginTop: 8,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    ...shadows.sm,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    fontSize: 18,
    fontWeight: '600',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
  },
  memberEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  removeMemberButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeMemberText: {
    fontSize: 20,
    fontWeight: '500',
    marginTop: -2,
  },
  emptyMembers: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyMembersIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyMembersText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  emptyMembersSubtext: {
    fontSize: 14,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    borderTopWidth: 1,
    ...shadows.lg,
  },
  saveButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  friendsPickerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  friendsPickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendsPickerIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  friendsPickerText: {
    fontSize: 16,
    fontWeight: '500',
  },
  chevronUp: {
    transform: [{ rotate: '90deg' }],
  },
  friendsList: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    ...shadows.sm,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
  },
  friendItemAdded: {
    opacity: 0.6,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  friendAvatarText: {
    fontSize: 16,
    fontWeight: '500',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 15,
    fontWeight: '500',
  },
  friendEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  addedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  addedBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  addFriendButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addFriendButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  orLine: {
    flex: 1,
    height: 1,
  },
  orText: {
    fontSize: 13,
    marginHorizontal: 12,
  },
  selectedCount: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectedCountText: {
    fontSize: 14,
    fontWeight: '500',
  },
  searchMemberCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    ...shadows.sm,
  },
  searchMemberHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  searchMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchMemberInput: {
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchMemberButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchMemberButtonText: {
    fontSize: 18,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 10,
  },
  searchResultAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultInfo: {
    flex: 1,
  },
  searchNotFound: {
    marginTop: 10,
    fontSize: 13,
    textAlign: 'center',
  },
  pendingMembersList: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    ...shadows.sm,
  },
  pendingMembersLabel: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
  },
  removePendingButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePendingText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
