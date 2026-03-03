import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api';
import { socketClient } from '../lib/socket';

export type SubscriptionTier = 'free' | 'monthly' | 'yearly' | 'lifetime';

export interface PaymentPlan {
  id: string;
  name: string;
  description: string;
  priceInCents: number;
  currency: string;
  billingPeriod: string;
  sortOrder: number;
}

interface AuthContextType {
  user: User | null;
  session: any;
  profile: UserProfile | null;
  loading: boolean;
  subscriptionTier: SubscriptionTier;
  subscriptionExpiresAt: Date | null;
  isPremium: boolean;
  paymentRequired: boolean;
  plans: PaymentPlan[];
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>;
  setPremium: (tier: SubscriptionTier, expiresAt: Date | null) => Promise<void>;
  refreshPaymentConfig: () => Promise<void>;
  refreshEntitlement: () => Promise<void>;
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

const SUBSCRIPTION_STORAGE_KEY = 'subscription';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>('free');
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<Date | null>(null);
  const [paymentRequired, setPaymentRequired] = useState(true);
  const [plans, setPlans] = useState<PaymentPlan[]>([]);

  const isPremium = React.useMemo(() => {
    if (!paymentRequired) return true;
    if (subscriptionTier === 'free') return false;
    if (subscriptionTier === 'lifetime') return true;
    if (!subscriptionExpiresAt) return false;
    return subscriptionExpiresAt > new Date();
  }, [subscriptionTier, subscriptionExpiresAt, paymentRequired]);

  const refreshPaymentConfig = async () => {
    try {
      const [configRes, plansRes] = await Promise.all([
        api.getPaymentConfig(),
        api.getPlans(),
      ]);
      setPaymentRequired(configRes.paymentRequired);
      setPlans(plansRes.plans);
    } catch {
      // Default to payment required on error so limits stay safe
    }
  };

  const refreshEntitlement = async () => {
    if (!paymentRequired) return;

    try {
      const entitlement = await api.getEntitlement();

      if (entitlement.hasLifetimeAccess) {
        await setPremium('lifetime', null);
      } else if (subscriptionTier === 'lifetime') {
        await setPremium('free', null);
      }
    } catch {
      // Keep current local subscription state on transient entitlement failures
    }
  };

  useEffect(() => {
    checkAuthStatus();
    loadSubscription();
    refreshPaymentConfig();
  }, []);

  const loadSubscription = async () => {
    try {
      const stored = await AsyncStorage.getItem(SUBSCRIPTION_STORAGE_KEY);
      if (stored) {
        const { tier, expiresAt } = JSON.parse(stored);
        setSubscriptionTier(tier as SubscriptionTier);
        setSubscriptionExpiresAt(expiresAt ? new Date(expiresAt) : null);
      }
    } catch {
      // ignore
    }
  };

  const setPremium = async (tier: SubscriptionTier, expiresAt: Date | null) => {
    setSubscriptionTier(tier);
    setSubscriptionExpiresAt(expiresAt);
    await AsyncStorage.setItem(
      SUBSCRIPTION_STORAGE_KEY,
      JSON.stringify({ tier, expiresAt: expiresAt?.toISOString() ?? null })
    );
  };

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

      await refreshEntitlement();

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

      await refreshEntitlement();

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

      await refreshEntitlement();

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
        SUBSCRIPTION_STORAGE_KEY,
      ]);
      setSubscriptionTier('free');
      setSubscriptionExpiresAt(null);
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
        session: user ? { user } : null,
        profile,
        loading,
        subscriptionTier,
        subscriptionExpiresAt,
        isPremium,
        paymentRequired,
        plans,
        signUp,
        signIn,
        signOut,
        updateProfile,
        setPremium,
        refreshPaymentConfig,
        refreshEntitlement,
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
