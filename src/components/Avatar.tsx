import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../store/authContext';

interface AvatarProps {
  name: string;
  index: number;
  size?: number;
  userId?: string;
  imageUri?: string;
}

export default function Avatar({ name, index, size = 36, userId, imageUri }: AvatarProps) {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const [imageError, setImageError] = useState(false);

  const getAvatarColor = (idx: number) => {
    return colors.avatarColors[idx % colors.avatarColors.length];
  };

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Check if this is the current user (by 'me' or by actual user ID)
  const isCurrentUser = userId === 'me' || userId === profile?.id;
  
  // Use imageUri if provided, otherwise use current user's avatar if it's the current user
  const avatarImage = imageUri || (isCurrentUser ? profile?.avatar_url : undefined);

  if (avatarImage && !imageError) {
    return (
      <Image
        source={{ uri: avatarImage }}
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: getAvatarColor(index),
          },
        ]}
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: getAvatarColor(index),
        },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.4, color: colors.textInverse }]}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontWeight: '500',
  },
});
