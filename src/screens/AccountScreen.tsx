import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Alert,
  TextInput,
  Modal,
  Image,
  Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import { useSupabaseStore as useStore } from '../store/supabaseStore';
import { useAuth } from '../store/authContext';
import { useTheme } from '../theme/ThemeContext';
import { shadows } from '../theme/colors';
import { formatCurrency } from '../lib/utils';
import { api } from '../lib/api';
import { RootStackParamList } from '../navigation/AppNavigator';

type NavigationProp = StackNavigationProp<RootStackParamList>;

export default function AccountScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { groups, friends, loadData } = useStore();
  const { colors, toggleTheme, isDark } = useTheme();
  const { user, signOut, profile: authProfile, updateProfile: updateAuthProfile, isPremium, subscriptionTier, subscriptionExpiresAt } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [editUsername, setEditUsername] = useState(authProfile?.username || '');
  const [editEmail, setEditEmail] = useState(authProfile?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | undefined>(authProfile?.avatar_url);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (authProfile) {
      setEditUsername(authProfile.username);
      setEditEmail(authProfile.email);
      setAvatarUri(authProfile.avatar_url);
    }
  }, [authProfile]);

  const totalExpenses = groups.reduce((sum, g) => sum + (g.totalSpent || 0), 0);
  const totalExpenseCount = groups.reduce((sum, g) => sum + (g.expenseCount || 0), 0);
  const totalGroups = groups.length;
  const totalFriends = friends.length;

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Please allow access to your photo library to set a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0] && user) {
      const localUri = result.assets[0].uri;
      setAvatarUri(localUri); // Show immediately while uploading
      setUploadingAvatar(true);

      try {
        // Upload via backend API
        const uploadResponse = await api.uploadImage(localUri);
        const publicUrl = api.getFullUrl(uploadResponse.url);

        // Update profile with the uploaded URL
        await updateAuthProfile({ avatar_url: publicUrl });
        setAvatarUri(publicUrl);

      } catch (error) {
        console.error('Error uploading avatar:', error);
        Alert.alert('Error', 'Failed to upload profile picture');
        setAvatarUri(authProfile?.avatar_url);
      } finally {
        setUploadingAvatar(false);
      }
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    try {
      // Update password if provided
      if (newPassword) {
        if (!currentPassword) {
          Alert.alert('Error', 'Please enter your current password');
          return;
        }
        if (newPassword !== confirmPassword) {
          Alert.alert('Error', 'New passwords do not match');
          return;
        }
        if (newPassword.length < 6) {
          Alert.alert('Error', 'Password must be at least 6 characters');
          return;
        }

        await api.changePassword(currentPassword, newPassword);
      }

      // Clear password fields and close modal
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
      setShowEditModal(false);
      Alert.alert('Success', 'Your profile has been updated.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    }
  };

  const MenuItem = ({
    icon,
    title,
    subtitle,
    onPress,
    danger = false,
    rightElement,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    danger?: boolean;
    rightElement?: React.ReactNode;
  }) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.menuIcon, danger && { backgroundColor: colors.dangerLight }]}>
        <Text style={styles.menuIconText}>{icon}</Text>
      </View>
      <View style={styles.menuContent}>
        <Text style={[styles.menuTitle, { color: danger ? colors.danger : colors.text }]}>{title}</Text>
        {subtitle && <Text style={[styles.menuSubtitle, { color: colors.textMuted }]}>{subtitle}</Text>}
      </View>
      {rightElement || (onPress && <Text style={[styles.menuArrow, { color: colors.textMuted }]}>›</Text>)}
    </TouchableOpacity>
  );

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.primary },
    safeArea: { flex: 1, backgroundColor: colors.primary },
    header: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24 },
    profileSection: { flexDirection: 'row', alignItems: 'center' },
    profileAvatar: { width: 70, height: 70, borderRadius: 35, borderWidth: 3, borderColor: colors.textInverse },
    profileAvatarPlaceholder: { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.textInverse, justifyContent: 'center', alignItems: 'center' },
    profileAvatarText: { fontSize: 24, fontWeight: '600', color: colors.primary },
    editAvatarBadge: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.primary },
    editAvatarBadgeText: { fontSize: 12 },
    profileInfo: { marginLeft: 16 },
    profileName: { fontSize: 24, fontWeight: '600', color: colors.textInverse },
    profileSubtitle: { fontSize: 14, color: colors.textInverse, opacity: 0.8, marginTop: 2 },
    scrollView: { flex: 1, backgroundColor: colors.background },
    scrollContent: { padding: 20, paddingBottom: 100 },
    statsRow: { flexDirection: 'row', marginBottom: 16, gap: 12 },
    statCard: { flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 16, alignItems: 'center', ...shadows.sm },
    statValue: { fontSize: 28, fontWeight: '600', color: colors.primary, marginBottom: 4 },
    statLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '400' },
    totalCard: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 16, padding: 20, marginBottom: 24, alignItems: 'center', ...shadows.md },
    totalIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.successLight, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    totalIconText: { fontSize: 28 },
    totalContent: { flex: 1 },
    totalLabel: { fontSize: 14, color: colors.textSecondary, marginBottom: 4 },
    totalValue: { fontSize: 28, fontWeight: '600', color: colors.text },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 14, fontWeight: '500', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, marginLeft: 4 },
    menuCard: { backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden', ...shadows.sm },
    menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    menuIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primaryLight + '20', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    menuIconText: { fontSize: 20 },
    menuContent: { flex: 1 },
    menuTitle: { fontSize: 16, fontWeight: '500', color: colors.text },
    menuSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    menuArrow: { fontSize: 24, color: colors.textMuted, fontWeight: '300' },
    menuDivider: { height: 1, backgroundColor: colors.border, marginLeft: 70 },
    appInfo: { alignItems: 'center', paddingVertical: 20 },
    appName: { fontSize: 18, fontWeight: '600', color: colors.primary, marginBottom: 4 },
    appVersion: { fontSize: 14, color: colors.textMuted, marginBottom: 8 },
    appCopyright: { fontSize: 14, color: colors.textMuted },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    modalContent: { width: '100%', backgroundColor: colors.card, borderRadius: 20, padding: 24, ...shadows.lg },
    modalTitle: { fontSize: 22, fontWeight: '600', color: colors.text, marginBottom: 20, textAlign: 'center' },
    inputGroup: { marginBottom: 16 },
    inputLabel: { fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: 8 },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, backgroundColor: colors.background, color: colors.text },
    divider: { height: 1, marginVertical: 20 },
    sectionLabel: { fontSize: 15, fontWeight: '500', marginBottom: 16 },
    modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
    modalButton: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    modalButtonCancel: { borderWidth: 1, borderColor: colors.border },
    modalButtonSave: { backgroundColor: colors.primary },
    modalButtonText: { fontSize: 16, fontWeight: '500' },
    notifModalContainer: { flex: 1, backgroundColor: colors.background },
    notifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    notifHeaderButton: { minWidth: 80, padding: 8 },
    notifCloseText: { fontSize: 16, fontWeight: '500', color: colors.primary },
    notifTitle: { fontSize: 18, fontWeight: '600', color: colors.text, flex: 1, textAlign: 'center' },
    notifMarkReadText: { fontSize: 14, fontWeight: '500', color: colors.primary, textAlign: 'right' },
    notifList: { flex: 1 },
    notifListContent: { padding: 16 },
    notifEmpty: { alignItems: 'center', paddingTop: 60 },
    notifEmptyIcon: { fontSize: 48, marginBottom: 16 },
    notifEmptyText: { fontSize: 16, color: colors.textMuted },
    notifItem: { flexDirection: 'row', padding: 16, borderRadius: 12, marginBottom: 10, backgroundColor: colors.card, ...shadows.sm },
    notifItemIcon: { marginRight: 12 },
    notifItemContent: { flex: 1 },
    notifItemTitle: { fontSize: 15, fontWeight: '500', color: colors.text, marginBottom: 4 },
    notifItemMessage: { fontSize: 14, color: colors.textSecondary, marginBottom: 6, lineHeight: 20 },
    notifItemTime: { fontSize: 12, color: colors.textMuted },
    clearNotifsButton: { margin: 16, padding: 16, borderRadius: 12, alignItems: 'center', backgroundColor: colors.dangerLight },
    clearNotifsText: { fontSize: 16, fontWeight: '500', color: colors.danger },
    premiumCard: { borderRadius: 16, padding: 20, marginBottom: 24, ...shadows.md, overflow: 'hidden' },
    premiumCardFree: { backgroundColor: colors.primary },
    premiumCardPaid: { backgroundColor: colors.successLight, borderWidth: 1, borderColor: colors.success },
    premiumBadgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    premiumBadgeIcon: { fontSize: 20, marginRight: 8 },
    premiumBadgeText: { fontSize: 16, fontWeight: '600' },
    premiumBadgeTextFree: { color: colors.textInverse },
    premiumBadgeTextPaid: { color: colors.success },
    premiumDescription: { fontSize: 14, marginBottom: 14, lineHeight: 20 },
    premiumDescriptionFree: { color: 'rgba(255,255,255,0.85)' },
    premiumDescriptionPaid: { color: colors.textSecondary },
    premiumButton: { borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    premiumButtonFree: { backgroundColor: colors.textInverse },
    premiumExpiry: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.profileSection}>
            <TouchableOpacity onPress={handlePickImage} activeOpacity={0.8}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.profileAvatar} />
              ) : (
                <View style={styles.profileAvatarPlaceholder}>
                  <Text style={styles.profileAvatarText}>{(authProfile?.username || 'U').slice(0, 2).toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.editAvatarBadge}>
                <Text style={styles.editAvatarBadgeText}>📷</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>@{authProfile?.username || 'user'}</Text>
              <TouchableOpacity onPress={() => setShowEditModal(true)}>
                <Text style={styles.profileSubtitle}>Tap to edit profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Premium / Subscription Card */}
          {!isPremium ? (
            <TouchableOpacity
              style={[styles.premiumCard, styles.premiumCardFree]}
              onPress={() => navigation.navigate('Payment')}
              activeOpacity={0.85}
            >
              <View style={styles.premiumBadgeRow}>
                <Text style={styles.premiumBadgeIcon}>✨</Text>
                <Text style={[styles.premiumBadgeText, styles.premiumBadgeTextFree]}>Upgrade to Premium</Text>
              </View>
              <Text style={[styles.premiumDescription, styles.premiumDescriptionFree]}>
                You're on the free plan (1 group, 2 expenses). Unlock unlimited for just $1/month.
              </Text>
              <View style={[styles.premiumButton, styles.premiumButtonFree]}>
                <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 15 }}>See Plans →</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={[styles.premiumCard, styles.premiumCardPaid]}>
              <View style={styles.premiumBadgeRow}>
                <Text style={styles.premiumBadgeIcon}>⭐</Text>
                <Text style={[styles.premiumBadgeText, styles.premiumBadgeTextPaid]}>
                  {subscriptionTier === 'lifetime' ? 'Lifetime Member' : subscriptionTier === 'yearly' ? 'Yearly Plan' : 'Monthly Plan'}
                </Text>
              </View>
              <Text style={[styles.premiumDescription, styles.premiumDescriptionPaid]}>
                You have unlimited groups and expenses.
              </Text>
              {subscriptionExpiresAt && (
                <Text style={styles.premiumExpiry}>
                  Renews: {subscriptionExpiresAt.toLocaleDateString()}
                </Text>
              )}
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statCard}><Text style={styles.statValue}>{totalGroups}</Text><Text style={styles.statLabel}>Groups</Text></View>
            <View style={styles.statCard}><Text style={styles.statValue}>{totalFriends}</Text><Text style={styles.statLabel}>Friends</Text></View>
            <View style={styles.statCard}><Text style={styles.statValue}>{totalExpenseCount}</Text><Text style={styles.statLabel}>Expenses</Text></View>
          </View>

          <View style={styles.totalCard}>
            <View style={styles.totalIcon}><Text style={styles.totalIconText}>💰</Text></View>
            <View style={styles.totalContent}>
              <Text style={styles.totalLabel}>Total Tracked</Text>
              <Text style={styles.totalValue}>{formatCurrency(totalExpenses, 'USD')}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Settings</Text>
            <View style={styles.menuCard}>

              <MenuItem icon="🎨" title="Dark Mode" subtitle={isDark ? 'On' : 'Off'} rightElement={<Switch value={isDark} onValueChange={toggleTheme} trackColor={{ false: colors.border, true: colors.primaryLight }} thumbColor={isDark ? colors.primary : colors.card} />} />
              <View style={styles.menuDivider} />
              <MenuItem icon="👤" title="Edit Profile" subtitle="Name and email" onPress={() => setShowEditModal(true)} />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Support</Text>
            <View style={styles.menuCard}>
              <MenuItem icon="❓" title="Help & FAQ" onPress={() => Alert.alert('Help', 'Need help? Contact us at support@splitly.app')} />
              <View style={styles.menuDivider} />
              <MenuItem icon="⭐" title="Rate the App" onPress={() => Alert.alert('Thanks!', 'Rating feature coming soon!')} />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.menuCard}>
              <MenuItem icon="📧" title="Logged in as" subtitle={authProfile?.email || user?.email || 'Unknown'} />
              <View style={styles.menuDivider} />
              <MenuItem 
                icon="🚪" 
                title="Sign Out" 
                danger 
                onPress={() => {
                  Alert.alert(
                    'Sign Out',
                    'Are you sure you want to sign out?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Sign Out', style: 'destructive', onPress: signOut },
                    ]
                  );
                }} 
              />
            </View>
          </View>

          <View style={styles.appInfo}>
            <Text style={styles.appName}>Splitly</Text>
            <Text style={styles.appVersion}>Version 1.0.0</Text>
            <Text style={styles.appCopyright}>Made with ❤️</Text>
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={showEditModal} transparent animationType="fade" onRequestClose={() => { setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setShowEditModal(false); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput style={styles.input} value={editEmail} onChangeText={setEditEmail} placeholder="your@email.com" placeholderTextColor={colors.textMuted} keyboardType="email-address" autoCapitalize="none" />
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Change Password</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Current Password</Text>
              <TextInput style={styles.input} value={currentPassword} onChangeText={setCurrentPassword} placeholder="Enter current password" placeholderTextColor={colors.textMuted} secureTextEntry autoCapitalize="none" />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>New Password</Text>
              <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder="At least 6 characters" placeholderTextColor={colors.textMuted} secureTextEntry autoCapitalize="none" />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirm Password</Text>
              <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter new password" placeholderTextColor={colors.textMuted} secureTextEntry autoCapitalize="none" />
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={() => { setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setShowEditModal(false); }}><Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonSave]} onPress={handleSaveProfile}><Text style={[styles.modalButtonText, { color: colors.textInverse }]}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
