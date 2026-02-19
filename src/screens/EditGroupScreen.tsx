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
  Share,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as MailComposer from 'expo-mail-composer';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useSupabaseStore as useStore } from '../store/supabaseStore';
import { useAuth } from '../store/authContext';
import { api } from '../lib/api';
import { User, Currency } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { shadows } from '../theme/colors';
import * as ImagePicker from 'expo-image-picker';
import Avatar from '../components/Avatar';

type EditGroupScreenNavigationProp = StackNavigationProp<RootStackParamList, 'EditGroup'>;
type EditGroupScreenRouteProp = RouteProp<RootStackParamList, 'EditGroup'>;

interface Props {
  navigation: EditGroupScreenNavigationProp;
  route: EditGroupScreenRouteProp;
}

const currencies: { value: Currency; label: string; symbol: string }[] = [
  { value: 'USD', label: 'US Dollar', symbol: '$' },
  { value: 'EUR', label: 'Euro', symbol: '€' },
  { value: 'GBP', label: 'British Pound', symbol: '£' },
  { value: 'INR', label: 'Indian Rupee', symbol: '₹' },
  { value: 'CAD', label: 'Canadian Dollar', symbol: 'C$' },
  { value: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
];

export default function EditGroupScreen({ navigation, route }: Props) {
  const { groupId } = route.params;
  const { groups, updateGroup, addMemberToGroup, removeMemberFromGroup, deleteGroup } = useStore();
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';
  const { colors, isDark } = useTheme();
  const group = groups.find((g) => g.id === groupId);

  const getAvatarColor = (index: number) => {
    return colors.avatarColors[index % colors.avatarColors.length];
  };

  const [name, setName] = useState(group?.name || '');
  const [description, setDescription] = useState(group?.description || '');
  const [groupImage, setGroupImage] = useState<string | undefined>(group?.imageUri);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [currency, setCurrency] = useState<Currency>(group?.currency || 'USD');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  // Add member by username search
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearching, setMemberSearching] = useState(false);
  const [memberAdding, setMemberAdding] = useState(false);
  const [memberSearchResult, setMemberSearchResult] = useState<{ id: string; name: string; email: string; avatar_url?: string } | null>(null);
  const [memberSearchNotFound, setMemberSearchNotFound] = useState(false);

  if (!group) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Group not found</Text>
      </View>
    );
  }

  const handleSearchMember = async () => {
    const query = memberSearch.trim();
    if (!query) return;

    if (query.toLowerCase() === profile?.username?.toLowerCase()) {
      Alert.alert('Cannot add yourself', 'You are already a member of this group.');
      return;
    }

    // Check if already a member
    const alreadyMember = group.members.some(
      (m) => m.username?.toLowerCase() === query.toLowerCase()
    );
    if (alreadyMember) {
      Alert.alert('Already a member', `@${query} is already in this group.`);
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
        const alreadyById = group.members.some((m) => m.id === data.id);
        if (alreadyById) {
          Alert.alert('Already a member', `@${data.name} is already in this group.`);
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

  const handleAddSearchedMember = async () => {
    if (!memberSearchResult) return;
    setMemberAdding(true);
    try {
      await addMemberToGroup(groupId, { id: memberSearchResult.id } as any);
      setMemberSearchResult(null);
      setMemberSearch('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add member');
    } finally {
      setMemberAdding(false);
    }
  };

  const handleRemoveMember = (memberId: string) => {
    if (group.members.length <= 2) {
      Alert.alert('Cannot Remove', 'A group must have at least 2 members');
      return;
    }
    Alert.alert(
      'Remove Member',
      'Are you sure you want to remove this member?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeMemberFromGroup(groupId, memberId),
        },
      ]
    );
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
        setGroupImage(group?.imageUri);
      } finally {
        setUploadingImage(false);
      }
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Missing Information', 'Please enter a group name');
      return;
    }

    updateGroup(groupId, {
      name: name.trim(),
      description: description.trim(),
      imageUri: groupImage,
      currency,
    });

    navigation.goBack();
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      'Delete Group',
      'Are you sure you want to delete this group? All expenses and settlements will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteGroup(groupId);
            navigation.navigate('MainTabs');
          },
        },
      ]
    );
  };

  const selectedCurrency = currencies.find((c) => c.value === currency);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={[styles.scrollView, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Group Details */}
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

          {/* Invite Code Section */}
          <View style={[styles.inviteCodeCard, { backgroundColor: colors.card }]}>
            <View style={styles.inviteCodeHeader}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Invite Code</Text>
              <Text style={[styles.inviteCodeBadge, { backgroundColor: colors.primaryLight + '20', color: colors.primary }]}>
                Share to invite
              </Text>
            </View>
            <Text style={[styles.inviteCode, { color: colors.primary }]}>{group.inviteCode}</Text>
            <View style={styles.inviteCodeButtons}>
              <TouchableOpacity
                style={[styles.inviteCodeButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={async () => {
                  await Clipboard.setStringAsync(group.inviteCode);
                  Alert.alert('Copied!', 'Invite code copied to clipboard');
                }}
              >
                <Text style={styles.inviteCodeButtonIcon}>📋</Text>
                <Text style={[styles.inviteCodeButtonText, { color: colors.text }]}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.inviteCodeButton, { backgroundColor: colors.primaryLight + '20' }]}
                onPress={async () => {
                  try {
                    await Share.share({
                      message: `Join my group "${group.name}" on Splitly!\n\nUse invite code: ${group.inviteCode}`,
                    });
                  } catch (error) {
                    // User cancelled
                  }
                }}
              >
                <Text style={styles.inviteCodeButtonIcon}>📤</Text>
                <Text style={[styles.inviteCodeButtonText, { color: colors.primary }]}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Members */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Members ({group.members.length})</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Add or remove members from this group
          </Text>

          <View style={[styles.addMemberCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.addMemberLabel, { color: colors.textSecondary }]}>
              Search by username to add a member
            </Text>
            <View style={styles.addMemberRow}>
              <TextInput
                style={[styles.addMemberInput, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                value={memberSearch}
                onChangeText={text => {
                  setMemberSearch(text);
                  setMemberSearchResult(null);
                  setMemberSearchNotFound(false);
                }}
                placeholder="Enter username..."
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={handleSearchMember}
                returnKeyType="search"
              />
              <TouchableOpacity
                style={[styles.addMemberSearchButton, { backgroundColor: colors.primary }, (!memberSearch.trim() || memberSearching) && { opacity: 0.5 }]}
                onPress={handleSearchMember}
                disabled={memberSearching || !memberSearch.trim()}
                activeOpacity={0.8}
              >
                {memberSearching ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.addMemberSearchIcon}>🔍</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Search result */}
            {memberSearchResult && (
              <View style={[styles.memberSearchResult, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                <Avatar
                  name={memberSearchResult.name}
                  index={0}
                  size={36}
                  userId={memberSearchResult.id}
                  imageUri={memberSearchResult.avatar_url}
                />
                <View style={styles.memberSearchResultInfo}>
                  <Text style={[styles.memberName, { color: colors.text }]}>@{memberSearchResult.name}</Text>
                  <Text style={[styles.memberEmail, { color: colors.textSecondary }]}>{memberSearchResult.email}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.addMemberConfirmButton, { backgroundColor: colors.success }, memberAdding && { opacity: 0.6 }]}
                  onPress={handleAddSearchedMember}
                  disabled={memberAdding}
                  activeOpacity={0.8}
                >
                  {memberAdding ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={[styles.addMemberButtonText, { color: colors.textInverse }]}>+ Add</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Not found */}
            {memberSearchNotFound && (
              <Text style={[styles.memberSearchNotFound, { color: colors.danger }]}>
                No user found for "{memberSearch.trim()}"
              </Text>
            )}
          </View>

          {/* Member List */}
          <View style={styles.membersList}>
            {group.members.map((member, index) => (
              <View key={member.id} style={[styles.memberCard, { backgroundColor: colors.card }]}>
                <Avatar
                  name={member.username}
                  index={index}
                  size={40}
                  userId={member.id}
                  imageUri={member.avatar}
                />
                <View style={styles.memberInfo}>
                  <Text style={[styles.memberName, { color: colors.text }]}>{member.username}</Text>
                  {member.email && (
                    <Text style={[styles.memberEmail, { color: colors.textSecondary }]}>{member.email}</Text>
                  )}
                </View>
                {member.id !== currentUserId && (
                  <TouchableOpacity
                    style={[styles.removeMemberButton, { backgroundColor: colors.dangerLight }]}
                    onPress={() => handleRemoveMember(member.id)}
                  >
                    <Text style={[styles.removeMemberText, { color: colors.danger }]}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={[styles.dangerTitle, { color: colors.danger }]}>Danger Zone</Text>
          <TouchableOpacity
            style={[styles.deleteButton, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}
            onPress={handleDeleteGroup}
          >
            <Text style={[styles.deleteButtonText, { color: colors.danger }]}>Delete Group</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: uploadingImage ? colors.textMuted : colors.primary }]}
          onPress={handleSave}
          activeOpacity={0.8}
          disabled={uploadingImage}
        >
          <Text style={[styles.saveButtonText, { color: colors.textInverse }]}>Save Changes</Text>
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
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
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
    padding: 14,
    marginBottom: 16,
    ...shadows.sm,
  },
  addMemberLabel: {
    fontSize: 13,
    marginBottom: 10,
  },
  addMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addMemberInput: {
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  addMemberSearchButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMemberSearchIcon: {
    fontSize: 18,
  },
  memberSearchResult: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 10,
  },
  memberSearchResultInfo: {
    flex: 1,
  },
  addMemberConfirmButton: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMemberButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addMemberButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  memberSearchNotFound: {
    marginTop: 10,
    fontSize: 13,
    textAlign: 'center',
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
  inviteCodeCard: {
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    ...shadows.sm,
  },
  inviteCodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  inviteCodeBadge: {
    fontSize: 11,
    fontWeight: '500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  inviteCode: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 16,
  },
  inviteCodeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  inviteCodeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inviteCodeButtonIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  inviteCodeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dangerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  deleteButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
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
  saveButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
});
