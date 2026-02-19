import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface NotificationModalProps {
  visible: boolean;
  type?: 'success' | 'error' | 'info';
  title: string;
  message: string;
  buttonText?: string;
  onClose: () => void;
}

const typeConfig = {
  success: {
    bg: '#DCFCE7',
    border: '#16A34A',
    icon: '✓',
    iconColor: '#16A34A',
    titleColor: '#15803D',
  },
  error: {
    bg: '#FEE2E2',
    border: '#DC2626',
    icon: '✕',
    iconColor: '#DC2626',
    titleColor: '#B91C1C',
  },
  info: {
    bg: '#DBEAFE',
    border: '#2563EB',
    icon: 'ℹ',
    iconColor: '#2563EB',
    titleColor: '#1D4ED8',
  },
};

export default function NotificationModal({
  visible,
  type = 'success',
  title,
  message,
  buttonText = 'OK',
  onClose,
}: NotificationModalProps) {
  const { colors } = useTheme();
  const cfg = typeConfig[type];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderTopColor: cfg.border },
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.icon, { color: cfg.iconColor }]}>{cfg.icon}</Text>
          </View>
          <Text style={[styles.title, { color: cfg.titleColor }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {message}
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: cfg.border }]}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>{buttonText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderTopWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 30,
    fontWeight: '700',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
