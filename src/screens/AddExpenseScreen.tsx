import React, { useState, useMemo } from 'react';
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
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useSupabaseStore as useStore } from '../store/supabaseStore';
import { useAuth } from '../store/authContext';
import { Split, User, ExpenseCategory } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { shadows } from '../theme/colors';
import Avatar from '../components/Avatar';

const CATEGORIES: { value: ExpenseCategory; label: string; icon: string }[] = [
  { value: 'food', label: 'Food & Drinks', icon: '🍔' },
  { value: 'transport', label: 'Transport', icon: '🚗' },
  { value: 'accommodation', label: 'Accommodation', icon: '🏨' },
  { value: 'entertainment', label: 'Entertainment', icon: '🎬' },
  { value: 'shopping', label: 'Shopping', icon: '🛍️' },
  { value: 'utilities', label: 'Utilities', icon: '💡' },
  { value: 'other', label: 'Other', icon: '📦' },
];

type AddExpenseScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'AddExpense'
>;
type AddExpenseScreenRouteProp = RouteProp<RootStackParamList, 'AddExpense'>;

interface Props {
  navigation: AddExpenseScreenNavigationProp;
  route: AddExpenseScreenRouteProp;
}

type SplitType = 'equal' | 'custom';

export default function AddExpenseScreen({ navigation, route }: Props) {
  const { groupId } = route.params;
  const { groups, addExpense } = useStore();
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';
  const { colors, isDark } = useTheme();
  const group = groups.find((g) => g.id === groupId);
  
  const getAvatarColor = (index: number) => {
    return colors.avatarColors[index % colors.avatarColors.length];
  };

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState<string>('');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [showPaidByPicker, setShowPaidByPicker] = useState(false);

  const members = group?.members || [];

  // Initialize selected members to all by default, and paidBy to current user
  React.useEffect(() => {
    if (members.length > 0 && selectedMembers.length === 0) {
      setSelectedMembers(members.map((m) => m.id));
      if (!paidBy) {
        // Set paidBy to current user if they're a member, otherwise first member
        const currentUserIsMember = members.some(m => m.id === currentUserId);
        setPaidBy(currentUserIsMember ? currentUserId : members[0].id);
      }
    }
  }, [members, currentUserId]);

  const toggleMember = (memberId: string) => {
    if (selectedMembers.includes(memberId)) {
      // Don't allow deselecting if it's the last selected member
      if (selectedMembers.length > 1) {
        setSelectedMembers(selectedMembers.filter((id) => id !== memberId));
      }
    } else {
      setSelectedMembers([...selectedMembers, memberId]);
    }
  };

  const splitAmount = useMemo(() => {
    const numericAmount = parseFloat(amount) || 0;
    if (splitType === 'equal' && selectedMembers.length > 0) {
      return numericAmount / selectedMembers.length;
    }
    return 0;
  }, [amount, splitType, selectedMembers]);

  const customTotal = useMemo(() => {
    return Object.values(customAmounts).reduce(
      (sum, val) => sum + (parseFloat(val) || 0),
      0
    );
  }, [customAmounts]);

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!description.trim()) {
      Alert.alert('Missing Information', 'Please enter a description');
      return;
    }

    const numericAmount = parseFloat(amount);
    if (!numericAmount || numericAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    if (!paidBy) {
      Alert.alert('Missing Information', 'Please select who paid');
      return;
    }

    if (selectedMembers.length === 0) {
      Alert.alert('Missing Information', 'Please select at least one member to split with');
      return;
    }

    if (splitType === 'custom') {
      if (Math.abs(customTotal - numericAmount) > 0.01) {
        Alert.alert(
          'Amount Mismatch',
          `Custom amounts total ${group?.currency || 'USD'} ${customTotal.toFixed(2)} but expense is ${group?.currency || 'USD'} ${numericAmount.toFixed(2)}`
        );
        return;
      }
    }

    let splits: Split[];
    if (splitType === 'equal') {
      const splitPer = numericAmount / selectedMembers.length;
      splits = selectedMembers.map((id) => ({
        userId: id,
        amount: splitPer,
      }));
    } else {
      splits = Object.entries(customAmounts)
        .filter(([_, val]) => parseFloat(val) > 0)
        .map(([userId, val]) => ({
          userId,
          amount: parseFloat(val),
        }));
    }

    try {
      setIsSaving(true);
      await addExpense({
        groupId,
        description: description.trim(),
        amount: numericAmount,
        currency: group?.currency || 'USD',
        paidBy,
        splits,
        splitType: splitType === 'equal' ? 'equal' : 'exact',
        category,
        date: new Date().toISOString(),
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to add expense. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const getMemberName = (userId: string) => {
    return members.find((m) => m.id === userId)?.username || 'Unknown';
  };

  const getMemberIndex = (userId: string) => {
    return members.findIndex((m) => m.id === userId);
  };

  if (!group) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>Group not found</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Description */}
        <View style={[styles.section, { paddingTop: 20 }]}>
          <View style={[styles.inputCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Description</Text>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={description}
              onChangeText={setDescription}
              placeholder="What was this expense for?"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        {/* Amount Input - Now as a form field */}
        <View style={styles.section}>
          <View style={[styles.inputCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Amount</Text>
            <View style={styles.amountInputRow}>
              <Text style={[styles.currencyPrefix, { color: colors.textMuted }]}>
                {group.currency === 'USD' && '$'}
                {group.currency === 'EUR' && '€'}
                {group.currency === 'GBP' && '£'}
                {group.currency === 'INR' && '₹'}
                {group.currency === 'CAD' && 'C$'}
                {group.currency === 'AUD' && 'A$'}
              </Text>
              <TextInput
                style={[styles.amountFieldInput, { color: colors.text }]}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </View>

        {/* Category */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Category</Text>
          <TouchableOpacity
            style={[styles.inputCard, { backgroundColor: colors.card }]}
            onPress={() => setShowCategoryPicker(!showCategoryPicker)}
            activeOpacity={0.7}
          >
            <View style={styles.categoryDisplay}>
              <Text style={styles.categoryIcon}>
                {CATEGORIES.find((c) => c.value === category)?.icon}
              </Text>
              <Text style={[styles.categoryLabel, { color: colors.text }]}>
                {CATEGORIES.find((c) => c.value === category)?.label}
              </Text>
              <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
            </View>
          </TouchableOpacity>

          {showCategoryPicker && (
            <View style={[styles.pickerList, { backgroundColor: colors.card }]}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  style={[
                    styles.pickerOption,
                    { borderBottomColor: colors.borderLight },
                    category === cat.value && [styles.pickerOptionSelected, { backgroundColor: colors.backgroundSecondary }],
                  ]}
                  onPress={() => {
                    setCategory(cat.value);
                    setShowCategoryPicker(false);
                  }}
                >
                  <Text style={styles.categoryPickerIcon}>{cat.icon}</Text>
                  <Text style={[styles.pickerName, { color: colors.text }]}>{cat.label}</Text>
                  {category === cat.value && (
                    <Text style={[styles.checkmark, { color: colors.primary }]}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Paid By */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Paid By</Text>
          <TouchableOpacity
            style={[styles.inputCard, { backgroundColor: colors.card }]}
            onPress={() => setShowPaidByPicker(!showPaidByPicker)}
            activeOpacity={0.7}
          >
            {paidBy ? (
              <View style={styles.paidByDisplay}>
                <Avatar
                  name={getMemberName(paidBy)}
                  index={getMemberIndex(paidBy)}
                  size={36}
                  userId={paidBy}
                  imageUri={members.find(m => m.id === paidBy)?.avatar}
                />
                <Text style={[styles.paidByName, { color: colors.text }]}>{getMemberName(paidBy)}</Text>
                <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
              </View>
            ) : (
              <Text style={[styles.placeholderText, { color: colors.textMuted }]}>Select who paid</Text>
            )}
          </TouchableOpacity>

          {showPaidByPicker && (
            <View style={[styles.pickerList, { backgroundColor: colors.card }]}>
              {members.map((member, index) => (
                <TouchableOpacity
                  key={member.id}
                  style={[
                    styles.pickerOption,
                    { borderBottomColor: colors.borderLight },
                    paidBy === member.id && [styles.pickerOptionSelected, { backgroundColor: colors.backgroundSecondary }],
                  ]}
                  onPress={() => {
                    setPaidBy(member.id);
                    setShowPaidByPicker(false);
                  }}
                >
                  <Avatar
                    name={member.username}
                    index={index}
                    size={32}
                    userId={member.id}
                    imageUri={member.avatar}
                  />
                  <Text style={[styles.pickerName, { color: colors.text }]}>{member.username}</Text>
                  {paidBy === member.id && (
                    <Text style={[styles.checkmark, { color: colors.primary }]}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Split Type */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Split Type</Text>
          <View style={[styles.splitTypeContainer, { backgroundColor: colors.card }]}>
            <TouchableOpacity
              style={[
                styles.splitTypeOption,
                splitType === 'equal' && [styles.splitTypeOptionActive, { backgroundColor: colors.primary }],
              ]}
              onPress={() => setSplitType('equal')}
            >
              <Text
                style={[
                  styles.splitTypeText,
                  { color: colors.textSecondary },
                  splitType === 'equal' && [styles.splitTypeTextActive, { color: colors.textInverse }],
                ]}
              >
                Equal Split
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.splitTypeOption,
                splitType === 'custom' && [styles.splitTypeOptionActive, { backgroundColor: colors.primary }],
              ]}
              onPress={() => setSplitType('custom')}
            >
              <Text
                style={[
                  styles.splitTypeText,
                  { color: colors.textSecondary },
                  splitType === 'custom' && [styles.splitTypeTextActive, { color: colors.textInverse }],
                ]}
              >
                Custom Amounts
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Split With */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Split With</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            {splitType === 'equal'
              ? 'Select members to split equally'
              : 'Enter custom amounts for each member'}
          </Text>

          <View style={styles.membersList}>
            {members.map((member, index) => {
              const isSelected = selectedMembers.includes(member.id);
              return (
                <View key={member.id} style={styles.memberRow}>
                  <TouchableOpacity
                    style={[
                      styles.memberCard,
                      { backgroundColor: colors.card },
                      isSelected && [styles.memberCardSelected, { borderColor: colors.primary }],
                    ]}
                    onPress={() => {
                      if (splitType === 'equal') {
                        toggleMember(member.id);
                      } else {
                        // In custom mode, toggle by setting/clearing amount
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={!isSelected && styles.memberAvatarDisabled}>
                      <Avatar
                        name={member.username}
                        index={index}
                        size={40}
                        userId={member.id}
                        imageUri={member.avatar}
                      />
                    </View>
                    <View style={styles.memberInfo}>
                      <Text
                        style={[
                          styles.memberName,
                          { color: colors.text },
                          !isSelected && [styles.memberNameDisabled, { color: colors.textMuted }],
                        ]}
                      >
                        {member.username}
                      </Text>
                      {splitType === 'equal' && isSelected && (
                        <Text style={[styles.memberSplit, { color: colors.primary }]}>
                          {group.currency === 'USD' && '$'}
                          {group.currency === 'EUR' && '€'}
                          {group.currency === 'GBP' && '£'}
                          {splitAmount.toFixed(2)}
                        </Text>
                      )}
                    </View>
                    {splitType === 'equal' && (
                      <View
                        style={[
                          styles.checkbox,
                          { borderColor: colors.border },
                          isSelected && [styles.checkboxChecked, { backgroundColor: colors.primary, borderColor: colors.primary }],
                        ]}
                      >
                        {isSelected && <Text style={[styles.checkboxIcon, { color: colors.textInverse }]}>✓</Text>}
                      </View>
                    )}
                  </TouchableOpacity>

                  {splitType === 'custom' && (
                    <View style={[styles.customAmountContainer, { backgroundColor: colors.backgroundSecondary }]}>
                      <Text style={[styles.customCurrency, { color: colors.textSecondary }]}>
                        {group.currency === 'USD' && '$'}
                        {group.currency === 'EUR' && '€'}
                        {group.currency === 'GBP' && '£'}
                      </Text>
                      <TextInput
                        style={[styles.customAmountInput, { color: colors.text }]}
                        value={customAmounts[member.id] || ''}
                        onChangeText={(val) =>
                          setCustomAmounts({ ...customAmounts, [member.id]: val })
                        }
                        placeholder="0.00"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {splitType === 'custom' && parseFloat(amount) > 0 && (
            <View
              style={[
                styles.totalCard,
                Math.abs(customTotal - parseFloat(amount)) < 0.01
                  ? [styles.totalCardMatch, { backgroundColor: colors.successLight }]
                  : [styles.totalCardMismatch, { backgroundColor: colors.dangerLight }],
              ]}
            >
              <Text style={[styles.totalLabel, { color: Math.abs(customTotal - parseFloat(amount)) < 0.01 ? colors.success : colors.danger }]}>Custom Total</Text>
              <Text style={[styles.totalAmount, { color: Math.abs(customTotal - parseFloat(amount)) < 0.01 ? colors.success : colors.danger }]}>
                {group.currency === 'USD' && '$'}
                {group.currency === 'EUR' && '€'}
                {group.currency === 'GBP' && '£'}
                {customTotal.toFixed(2)} / {parseFloat(amount).toFixed(2)}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.borderLight }]}>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: isSaving ? colors.textMuted : colors.primary }]}
          onPress={handleSave}
          activeOpacity={0.8}
          disabled={isSaving}
        >
          <Text style={[styles.saveButtonText, { color: colors.textInverse }]}>
            {isSaving ? 'Saving...' : 'Add Expense'}
          </Text>
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
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencyPrefix: {
    fontSize: 20,
    fontWeight: '500',
    marginRight: 8,
  },
  amountFieldInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '500',
    padding: 0,
  },
  section: {
    padding: 20,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  inputCard: {
    borderRadius: 12,
    padding: 16,
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
  paidByDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paidByAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paidByAvatarText: {
    fontSize: 14,
    fontWeight: '600',
  },
  paidByName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    marginLeft: 12,
  },
  chevron: {
    fontSize: 20,
  },
  categoryDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  categoryLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
  },
  categoryPickerIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  placeholderText: {
    fontSize: 16,
  },
  pickerList: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    ...shadows.sm,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
  },
  pickerOptionSelected: {
  },
  pickerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerAvatarText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pickerName: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
  },
  checkmark: {
    fontSize: 18,
    fontWeight: '600',
  },
  splitTypeContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginTop: 12,
  },
  splitTypeOption: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  splitTypeOptionActive: {
  },
  splitTypeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  splitTypeTextActive: {
  },
  membersList: {
    marginTop: 8,
  },
  memberRow: {
    marginBottom: 10,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    ...shadows.sm,
  },
  memberCardSelected: {
    borderWidth: 2,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarDisabled: {
    opacity: 0.4,
  },
  memberAvatarText: {
    fontSize: 16,
    fontWeight: '600',
  },
  memberAvatarTextDisabled: {
    opacity: 0.5,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
  },
  memberNameDisabled: {
  },
  memberSplit: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
  },
  checkboxIcon: {
    fontSize: 14,
    fontWeight: '600',
  },
  customAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 52,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  customCurrency: {
    fontSize: 16,
    fontWeight: '500',
    marginRight: 4,
  },
  customAmountInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  totalCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalCardMatch: {
  },
  totalCardMismatch: {
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  totalAmount: {
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
