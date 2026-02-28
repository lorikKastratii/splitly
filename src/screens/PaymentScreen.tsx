import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStripe } from '@stripe/stripe-react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth, SubscriptionTier, PaymentPlan } from '../store/authContext';
import { useTheme } from '../theme/ThemeContext';
import { shadows } from '../theme/colors';
import { api } from '../lib/api';

type NavigationProp = StackNavigationProp<RootStackParamList, 'Payment'>;

interface Props {
  navigation: NavigationProp;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  eur: '\u20AC',
  usd: '$',
  gbp: '\u00A3',
};

function formatPlanPrice(priceInCents: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency.toLowerCase()] || currency.toUpperCase() + ' ';
  const amount = (priceInCents / 100).toFixed(priceInCents % 100 === 0 ? 0 : 2);
  return `${symbol}${amount}`;
}

function formatBillingPeriod(period: string): string {
  switch (period.toLowerCase()) {
    case 'monthly': return '/month';
    case 'yearly': return '/year';
    case 'lifetime': return 'one-time';
    default: return `/${period}`;
  }
}

function billingPeriodToTier(period: string): SubscriptionTier {
  switch (period.toLowerCase()) {
    case 'monthly': return 'monthly';
    case 'yearly': return 'yearly';
    case 'lifetime': return 'lifetime';
    default: return 'monthly';
  }
}

export default function PaymentScreen({ navigation }: Props) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { setPremium, plans } = useAuth();
  const { colors } = useTheme();

  const sortedPlans = [...plans].sort((a, b) => a.sortOrder - b.sortOrder);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    sortedPlans.length > 0 ? sortedPlans[Math.min(1, sortedPlans.length - 1)].id : null
  );
  const [loading, setLoading] = useState(false);

  const selectedPlan = sortedPlans.find((p) => p.id === selectedPlanId);

  const handlePurchase = async () => {
    if (!selectedPlan) return;

    setLoading(true);
    try {
      const { clientSecret } = await api.createPaymentIntent(selectedPlan.id);

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'Splitly',
        style: 'automatic',
      });

      if (initError) {
        Alert.alert('Error', initError.message);
        return;
      }

      const { error: paymentError } = await presentPaymentSheet();

      if (paymentError) {
        if (paymentError.code !== 'Canceled') {
          Alert.alert('Payment Failed', paymentError.message);
        }
        return;
      }

      const tier = billingPeriodToTier(selectedPlan.billingPeriod);
      let expiresAt: Date | null = null;
      if (tier === 'monthly') {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
      } else if (tier === 'yearly') {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 365);
      }

      await setPremium(tier, expiresAt);

      Alert.alert(
        'Welcome to Premium!',
        'Your subscription is now active. Enjoy unlimited groups and expenses.',
        [{ text: 'Great!', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    safeArea: { flex: 1 },
    header: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 32,
      alignItems: 'center',
    },
    headerTitle: { fontSize: 26, fontWeight: '700', color: colors.textInverse, marginBottom: 6 },
    headerSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
    content: { padding: 20, paddingBottom: 40 },
    freeLimitsCard: {
      backgroundColor: colors.dangerLight,
      borderRadius: 14,
      padding: 16,
      marginBottom: 20,
      flexDirection: 'row',
      alignItems: 'center',
    },
    freeLimitsIcon: { fontSize: 22, marginRight: 12 },
    freeLimitsText: { flex: 1, fontSize: 14, color: colors.danger, lineHeight: 20 },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    planCard: {
      borderRadius: 16,
      padding: 18,
      marginBottom: 12,
      borderWidth: 2,
      ...shadows.sm,
    },
    planCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight + '15',
    },
    planCardUnselected: {
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    planLeft: { flex: 1 },
    planLabel: { fontSize: 18, fontWeight: '600', color: colors.text },
    planPriceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
    planPrice: { fontSize: 28, fontWeight: '700', color: colors.primary },
    planPeriod: { fontSize: 14, color: colors.textSecondary, marginLeft: 2 },
    planBadge: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    planBadgeText: { fontSize: 12, fontWeight: '600', color: colors.textInverse },
    planRadio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 12,
    },
    planRadioSelected: { borderColor: colors.primary },
    planRadioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
    featureList: { marginTop: 4 },
    featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    featureCheck: { fontSize: 14, color: colors.primary, marginRight: 8 },
    featureText: { fontSize: 14, color: colors.textSecondary },
    ctaButton: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 8,
      ...shadows.md,
    },
    ctaButtonDisabled: { opacity: 0.6 },
    ctaButtonText: { fontSize: 18, fontWeight: '600', color: colors.textInverse },
    ctaSubtext: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 10 },
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Upgrade to Premium</Text>
          <Text style={styles.headerSubtitle}>Unlimited groups & expenses for your whole journey</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.freeLimitsCard}>
            <Text style={styles.freeLimitsIcon}>⚠️</Text>
            <Text style={styles.freeLimitsText}>
              Free plan: 1 group and 2 expenses total. Upgrade to remove all limits.
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Choose a plan</Text>

          {sortedPlans.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Loading plans...</Text>
            </View>
          ) : (
            sortedPlans.map((plan, index) => {
              const isSelected = selectedPlanId === plan.id;
              const isMiddle = sortedPlans.length >= 2 && index === 1;
              return (
                <TouchableOpacity
                  key={plan.id}
                  style={[styles.planCard, isSelected ? styles.planCardSelected : styles.planCardUnselected]}
                  onPress={() => setSelectedPlanId(plan.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.planHeader}>
                    <View style={styles.planLeft}>
                      <Text style={styles.planLabel}>{plan.name}</Text>
                      <View style={styles.planPriceRow}>
                        <Text style={styles.planPrice}>{formatPlanPrice(plan.priceInCents, plan.currency)}</Text>
                        <Text style={styles.planPeriod}>{formatBillingPeriod(plan.billingPeriod)}</Text>
                      </View>
                    </View>
                    {isMiddle && (
                      <View style={styles.planBadge}>
                        <Text style={styles.planBadgeText}>Best Value</Text>
                      </View>
                    )}
                    <View style={[styles.planRadio, isSelected && styles.planRadioSelected]}>
                      {isSelected && <View style={styles.planRadioDot} />}
                    </View>
                  </View>

                  {plan.description ? (
                    <View style={styles.featureList}>
                      {plan.description.split('\n').filter(Boolean).map((line) => (
                        <View key={line} style={styles.featureRow}>
                          <Text style={styles.featureCheck}>✓</Text>
                          <Text style={styles.featureText}>{line}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })
          )}

          <TouchableOpacity
            style={[styles.ctaButton, (loading || !selectedPlan) && styles.ctaButtonDisabled]}
            onPress={handlePurchase}
            disabled={loading || !selectedPlan}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={styles.ctaButtonText}>
                Continue with {selectedPlan?.name || 'Plan'}
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.ctaSubtext}>
            Secure payment via Stripe. Cancel anytime.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
