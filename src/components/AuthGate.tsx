import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '../store/authContext';
import { useTheme } from '../theme/ThemeContext';
import SignInScreen from '../screens/SignInScreen';
import SignUpScreen from '../screens/SignUpScreen';

interface Props {
  children: React.ReactNode;
}

export default function AuthGate({ children }: Props) {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  const [showSignUp, setShowSignUp] = useState(false);

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Show auth screens if not logged in
  if (!user) {
    if (showSignUp) {
      return <SignUpScreen onSwitchToSignIn={() => setShowSignUp(false)} />;
    }
    return <SignInScreen onSwitchToSignUp={() => setShowSignUp(true)} />;
  }

  // User is authenticated, show the app
  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
