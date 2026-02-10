import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Share,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../theme/ThemeContext';
import { shadows } from '../theme/colors';

interface Props {
  visible: boolean;
  inviteCode: string;
  groupName: string;
  onClose: () => void;
}

export default function InviteCodeModal({ visible, inviteCode, groupName, onClose }: Props) {
  const { colors, isDark } = useTheme();
  
  const handleCopy = async () => {
    await Clipboard.setStringAsync(inviteCode);
    Alert.alert('Copied!', 'Invite code copied to clipboard');
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join my group "${groupName}" on Splitly!\n\nUse invite code: ${inviteCode}`,
      });
    } catch (error) {
      // User cancelled
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.card }]}>
          <View style={[styles.iconContainer, { backgroundColor: colors.successLight }]}>
            <Text style={styles.icon}>🎉</Text>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>Group Created!</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Share this invite code with friends so they can join "{groupName}"
          </Text>

          <View style={[styles.codeContainer, { backgroundColor: colors.background, borderColor: colors.primary }]}>
            <Text style={[styles.codeLabel, { color: colors.textMuted }]}>INVITE CODE</Text>
            <Text style={[styles.code, { color: colors.primary }]}>{inviteCode}</Text>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.copyButton, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={handleCopy}
              activeOpacity={0.7}
            >
              <Text style={styles.copyButtonIcon}>📋</Text>
              <Text style={[styles.copyButtonText, { color: colors.text }]}>Copy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shareButton, { backgroundColor: colors.primaryLight + '20' }]}
              onPress={handleShare}
              activeOpacity={0.7}
            >
              <Text style={styles.shareButtonIcon}>📤</Text>
              <Text style={[styles.shareButtonText, { color: colors.primary }]}>Share</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.doneButton, { backgroundColor: colors.primary }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={[styles.doneButtonText, { color: colors.textInverse }]}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    ...shadows.lg,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  codeContainer: {
    borderRadius: 16,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  codeLabel: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 1,
    marginBottom: 8,
  },
  code: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    width: '100%',
  },
  copyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
  },
  copyButtonIcon: {
    fontSize: 18,
  },
  copyButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  shareButtonIcon: {
    fontSize: 18,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  doneButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 17,
    fontWeight: '500',
  },
});
