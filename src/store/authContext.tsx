import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { api } from '../lib/api';
import { socketClient } from '../lib/socket';

export type SubscriptionTier = 'free' | 'trialing' | 'monthly' | 'yearly' | 'lifetime';

export interface PaymentPlan {
  id: string;
  name: string;
  description: string;
  priceInCents: number;
  currency: string;
  billingPeriod: string;
  sortOrder: number;
}

export interface FeatureLimits {
  maxGroups: number | null;
  maxExpenses: number | null;
}

const DEFAULT_FREE_LIMITS: FeatureLimits = {
  maxGroups: 1,
  maxExpenses: 2,
};

interface AuthContextType {
  user: User | null;
  session: any;
  profile: UserProfile | null;
  loading: boolean;
  subscriptionTier: SubscriptionTier;
  subscriptionExpiresAt: Date | null;
  trialEnd: Date | null;
  isPremium: boolean;
  paymentRequired: boolean;
  plans: PaymentPlan[];
  featureLimits: FeatureLimits;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>;
  setPremium: (tier: SubscriptionTier, expiresAt: Date | null) => Promise<void>;
  setTrialing: (trialEnd: Date, subscriptionId: string) => Promise<void>;
  cancelTrial: () => Promise<void>;
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
const TRIAL_STORAGE_KEY = 'trial';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>('free');
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<Date | null>(null);
  const [trialEnd, setTrialEnd] = useState<Date | null>(null);
  const [trialSubscriptionId, setTrialSubscriptionId] = useState<string | null>(null);
  const [paymentRequired, setPaymentRequired] = useState(true);
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [featureLimits, setFeatureLimits] = useState<FeatureLimits>(DEFAULT_FREE_LIMITS);

  const isPremium = React.useMemo(() => {
    if (!paymentRequired) return true;
    if (subscriptionTier === 'lifetime') return true;
    if (subscriptionTier === 'trialing') return trialEnd ? trialEnd > new Date() : false;
    if (subscriptionTier === 'free') return false;
    if (!subscriptionExpiresAt) return false;
    return subscriptionExpiresAt > new Date();
  }, [subscriptionTier, subscriptionExpiresAt, trialEnd, paymentRequired]);

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
    try {
      const [entitlement, featuresRes] = await Promise.all([
        api.getEntitlement(),
        api.getFeatures().catch(() => null),
      ]);

      if (entitlement.hasLifetimeAccess) {
        await setPremium('lifetime', null);
      } else if (subscriptionTier === 'lifetime') {
        await setPremium('free', null);
      }

      if (featuresRes?.features) {
        const features = featuresRes.features;
        const getNumeric = (key: string) => {
          const f = features.find((feat) => feat.key === key);
          return f?.type === 'numeric' && f.numericValue != null ? f.numericValue : null;
        };
        setFeatureLimits({
          maxGroups: getNumeric('max_groups') ?? DEFAULT_FREE_LIMITS.maxGroups,
          maxExpenses: getNumeric('max_expenses') ?? DEFAULT_FREE_LIMITS.maxExpenses,
        });
      }
    } catch {
      // Keep current local subscription state on transient entitlement failures
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      await loadSubscription();
      await refreshPaymentConfig();
      await checkAuthStatus();
    };

    initializeAuth();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && user) {
        refreshEntitlement();
      }
    });

    return () => subscription.remove();
  }, [user, refreshEntitlement]);

  useEffect(() => {
    if (!user) return;

    const handleTrialConverted = () => {
      setSubscriptionTier('monthly');
      setTrialEnd(null);
      setTrialSubscriptionId(null);
      AsyncStorage.removeItem(TRIAL_STORAGE_KEY).catch(() => {});
      refreshEntitlement();
    };

    const handleTrialExpired = () => {
      setSubscriptionTier('free');
      setTrialEnd(null);
      setTrialSubscriptionId(null);
      Promise.all([
        AsyncStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify({ tier: 'free', expiresAt: null })),
        AsyncStorage.removeItem(TRIAL_STORAGE_KEY),
      ]).catch(() => {});
    };

    const handleTrialEndingSoon = (data: { trialEnd: string }) => {
      if (data?.trialEnd) setTrialEnd(new Date(data.trialEnd));
    };

    socketClient.on('trial:converted', handleTrialConverted);
    socketClient.on('trial:expired', handleTrialExpired);
    socketClient.on('trial:ending_soon', handleTrialEndingSoon);
    socketClient.on('payment:succeeded', refreshEntitlement);
    socketClient.on('subscription:updated', refreshEntitlement);

    return () => {
      socketClient.off('trial:converted', handleTrialConverted);
      socketClient.off('trial:expired', handleTrialExpired);
      socketClient.off('trial:ending_soon', handleTrialEndingSoon);
      socketClient.off('payment:succeeded', refreshEntitlement);
      socketClient.off('subscription:updated', refreshEntitlement);
    };
  }, [user?.id]);

  const loadSubscription = async () => {
    try {
      const [stored, storedTrial] = await AsyncStorage.multiGet([SUBSCRIPTION_STORAGE_KEY, TRIAL_STORAGE_KEY]);
      if (stored[1]) {
        const { tier, expiresAt } = JSON.parse(stored[1]);
        setSubscriptionTier(tier as SubscriptionTier);
        setSubscriptionExpiresAt(expiresAt ? new Date(expiresAt) : null);
      }
      if (storedTrial[1]) {
        const { trialEnd: storedTrialEnd, subscriptionId } = JSON.parse(storedTrial[1]);
        setTrialEnd(storedTrialEnd ? new Date(storedTrialEnd) : null);
        setTrialSubscriptionId(subscriptionId ?? null);
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

  const setTrialing = async (trialEndDate: Date, subscriptionId: string) => {
    setSubscriptionTier('trialing');
    setTrialEnd(trialEndDate);
    setTrialSubscriptionId(subscriptionId);
    await Promise.all([
      AsyncStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify({ tier: 'trialing', expiresAt: null })),
      AsyncStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify({ trialEnd: trialEndDate.toISOString(), subscriptionId })),
    ]);
  };

  const cancelTrial = async () => {
    if (!trialSubscriptionId) return;
    await api.cancelTrial(trialSubscriptionId);
    setSubscriptionTier('free');
    setTrialEnd(null);
    setTrialSubscriptionId(null);
    await Promise.all([
      AsyncStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify({ tier: 'free', expiresAt: null })),
      AsyncStorage.removeItem(TRIAL_STORAGE_KEY),
    ]);
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
        TRIAL_STORAGE_KEY,
      ]);
      setSubscriptionTier('free');
      setSubscriptionExpiresAt(null);
      setTrialEnd(null);
      setTrialSubscriptionId(null);
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
        trialEnd,
        isPremium,
        paymentRequired,
        plans,
        featureLimits,
        signUp,
        signIn,
        signOut,
        updateProfile,
        setPremium,
        setTrialing,
        cancelTrial,
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
