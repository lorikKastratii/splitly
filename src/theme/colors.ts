export const lightColors = {
  // Primary palette - Deep Teal
  primary: '#0F766E',
  primaryLight: '#0D9488',
  primaryDark: '#115E59',
  primaryGradient: ['#0F766E', '#0891B2'],
  
  // Secondary palette - Deep Coral
  secondary: '#EA580C',
  secondaryLight: '#F97316',
  secondaryDark: '#C2410C',
  
  // Status colors
  success: '#059669',
  successLight: '#D1FAE5',
  danger: '#E11D48',
  dangerLight: '#FFE4E6',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  info: '#0284C7',
  
  // Backgrounds
  background: '#F1F5F9',
  backgroundSecondary: '#E2E8F0',
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',
  
  // Borders
  border: '#CBD5E1',
  borderLight: '#E2E8F0',
  
  // Text
  text: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  textLight: '#94A3B8',
  textInverse: '#FFFFFF',
  
  // Shadows (for iOS)
  shadow: '#000000',
  
  // Avatar colors - Rich & deep
  avatarColors: ['#0F766E', '#0891B2', '#EA580C', '#E11D48', '#7C3AED', '#DB2777', '#059669', '#CA8A04'],
};

export const darkColors = {
  // Primary palette - Deep Teal (brighter for dark mode)
  primary: '#14B8A6',
  primaryLight: '#2DD4BF',
  primaryDark: '#0F766E',
  primaryGradient: ['#14B8A6', '#06B6D4'],
  
  // Secondary palette - Deep Coral
  secondary: '#F97316',
  secondaryLight: '#FB923C',
  secondaryDark: '#EA580C',
  
  // Status colors
  success: '#10B981',
  successLight: '#064E3B',
  danger: '#F43F5E',
  dangerLight: '#4C0519',
  warning: '#F59E0B',
  warningLight: '#451A03',
  info: '#0EA5E9',
  
  // Backgrounds
  background: '#0F172A',
  backgroundSecondary: '#1E293B',
  card: '#1E293B',
  cardElevated: '#334155',
  
  // Borders
  border: '#334155',
  borderLight: '#475569',
  
  // Text
  text: '#F1F5F9',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  textLight: '#64748B',
  textInverse: '#0F172A',
  
  // Shadows (for iOS)
  shadow: '#000000',
  
  // Avatar colors - Rich & deep
  avatarColors: ['#14B8A6', '#06B6D4', '#F97316', '#F43F5E', '#A78BFA', '#F472B6', '#10B981', '#FBBF24'],
};

export type ThemeColors = typeof lightColors;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 5,
  },
};

// Default export for backward compatibility
export const colors = lightColors;

