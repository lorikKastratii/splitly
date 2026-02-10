import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/theme/ThemeContext';
import { AuthProvider, useAuth } from './src/store/authContext';
import { useSupabaseStore } from './src/store/supabaseStore';
import AuthGate from './src/components/AuthGate';

function AppContent() {
  const { user } = useAuth();
  const { setUserId, subscribeToGroups, loadData, userId, groups } = useSupabaseStore();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const initializeUser = async () => {
      // Clear old AsyncStorage data when user changes
      await AsyncStorage.multiRemove(['groups', 'expenses', 'settlements', 'friends', 'userProfile']);
      
      // Set user ID in store when auth state changes
      setUserId(user?.id || null);
      
      // Load data from Supabase
      if (user) {
        await loadData();
      }
    };
    
    initializeUser();
  }, [user?.id]);

  useEffect(() => {
    // Subscribe to real-time updates when user is logged in AND groups are loaded
    if (user && userId && groups.length > 0) {
      console.log('🚀 Setting up real-time subscription for user:', userId, 'groups:', groups.length);
      const unsubscribe = subscribeToGroups();
      
      // Listen for app state changes to refresh data when app comes to foreground
      const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
        if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
          console.log('📱 App came to foreground, refreshing data...');
          loadData();
        }
        appState.current = nextAppState;
      });
      
      return () => {
        unsubscribe();
        subscription.remove();
      };
    }
  }, [user, userId, groups.length]);

  return (
    <AuthGate>
      <AppNavigator />
      <StatusBar style="auto" />
    </AuthGate>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
