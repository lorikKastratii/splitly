import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useSupabaseStore as useStore } from '../store/supabaseStore';
import { User } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { shadows } from '../theme/colors';

type JoinGroupScreenNavigationProp = StackNavigationProp<RootStackParamList, 'JoinGroup'>;

interface Props {
  navigation: JoinGroupScreenNavigationProp;
}

// Default user - the person joining
const ME: User = {
  id: 'me',
  name: 'Me',
  email: undefined,
};

export default function JoinGroupScreen({ navigation }: Props) {
  const { joinGroupByCode } = useStore();
  const { colors, isDark } = useTheme();
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleJoin = async () => {
    const trimmedCode = code.trim().toUpperCase();
    
    if (!trimmedCode) {
      Alert.alert('Missing Code', 'Please enter an invite code');
      return;
    }

    if (trimmedCode.length !== 6) {
      Alert.alert('Invalid Code', 'Invite codes are 6 characters long');
      return;
    }

    setIsLoading(true);
    const result = await joinGroupByCode(trimmedCode);
    setIsLoading(false);

    if (result.success) {
      Alert.alert(
        'Success! 🎉',
        `You have joined "${result.groupName}"`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } else {
      Alert.alert('Unable to Join', result.error || 'Unknown error');
    }
  };

  const formatCode = (text: string) => {
    // Only allow alphanumeric characters and convert to uppercase
    return text.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: colors.primaryLight + '20' }]}>
          <Text style={styles.icon}>🔗</Text>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>Join a Group</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Enter the 6-character invite code shared by your friend
        </Text>

        <View style={[styles.inputCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Invite Code</Text>
          <TextInput
            style={[styles.codeInput, { color: colors.text, backgroundColor: colors.background }]}
            value={code}
            onChangeText={(text) => setCode(formatCode(text))}
            placeholder="ABC123"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            textAlign="center"
          />
        </View>

        <TouchableOpacity
          style={[
            styles.joinButton, 
            { backgroundColor: colors.primary }, 
            (!code.trim() || isLoading) && { backgroundColor: colors.textMuted }
          ]}
          onPress={handleJoin}
          disabled={!code.trim() || isLoading}
        >
          <Text style={[styles.joinButtonText, { color: colors.textInverse }]}>
            {isLoading ? 'Joining...' : 'Join Group'}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.helpText, { color: colors.textMuted }]}>
          Don't have a code? Ask your friend who created the group to share their invite code with you.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  inputCard: {
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 24,
    ...shadows.sm,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
    textAlign: 'center',
  },
  codeInput: {
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: 8,
    paddingVertical: 16,
    borderRadius: 12,
    textAlign: 'center',
  },
  joinButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    ...shadows.md,
  },
  joinButtonText: {
    fontSize: 18,
    fontWeight: '500',
  },
  helpText: {
    marginTop: 32,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
});
