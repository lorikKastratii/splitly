import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api';
import { socketClient } from '../lib/socket';

interface AuthContextType {
  user: User | null;
  session: any; // For compatibility with old screens
  profile: UserProfile | null; // For compatibility with old screens
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>;
}

interface UserProfile {
  id: string;
  email: string;
  username: string; // Maps to 'name' in API
  avatar_url?: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  created_at: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');

      if (!token) {
        setLoading(false);
        return;
      }

      const response = await api.getProfile();
      const userData = response.user;
      setUser(userData);
      setProfile({
        id: userData.id,
        email: userData.email,
        username: userData.name,
        avatar_url: userData.avatar_url,
      });

      await socketClient.connect();
    } catch (error) {
      console.error('Auth check error:', error);
      await AsyncStorage.removeItem('auth_token');
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const response = await api.register(email, password, name);
      const userData = response.user;
      setUser(userData);
      setProfile({
        id: userData.id,
        email: userData.email,
        username: userData.name,
        avatar_url: userData.avatar_url,
      });

      await socketClient.connect();

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const response = await api.login(email, password);
      const userData = response.user;
      setUser(userData);
      setProfile({
        id: userData.id,
        email: userData.email,
        username: userData.name,
        avatar_url: userData.avatar_url,
      });

      await AsyncStorage.multiRemove(['groups', 'expenses', 'settlements', 'friends']);

      await socketClient.connect();

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      await api.logout();
      socketClient.disconnect();
      setUser(null);
      setProfile(null);

      await AsyncStorage.multiRemove([
        'auth_token',
        'groups',
        'expenses',
        'settlements',
        'friends',
      ]);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      // Map username to name for API
      const apiUpdates: any = {};
      if (updates.username) apiUpdates.name = updates.username;
      if (updates.avatar_url !== undefined) apiUpdates.avatar_url = updates.avatar_url;

      const response = await api.updateProfile(apiUpdates);
      const userData = response.user;
      setUser(userData);
      setProfile({
        id: userData.id,
        email: userData.email,
        username: userData.name,
        avatar_url: userData.avatar_url,
      });
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session: user ? { user } : null, // Compatibility
        profile,
        loading,
        signUp,
        signIn,
        signOut,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
