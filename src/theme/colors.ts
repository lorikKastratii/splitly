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
  // Primary palette - Vibrant Teal (more pop on dark)
  primary: '#2DD4BF',
  primaryLight: '#5EEAD4',
  primaryDark: '#14B8A6',
  primaryGradient: ['#2DD4BF', '#22D3EE'],

  // Secondary palette - Warm Orange
  secondary: '#FB923C',
  secondaryLight: '#FDBA74',
  secondaryDark: '#EA580C',

  // Status colors - brighter, clearer intent
  success: '#34D399',
  successLight: '#0B2E20',
  danger: '#FB7185',
  dangerLight: '#2D0A14',
  warning: '#FCD34D',
  warningLight: '#2D1A00',
  info: '#38BDF8',

  // Backgrounds - clear elevation hierarchy
  background: '#0D1117',
  backgroundSecondary: '#161D2B',
  card: '#1C2638',
  cardElevated: '#263347',

  // Borders - visible but subtle
  border: '#2C3E54',
  borderLight: '#3A5068',

  // Text - high readability
  text: '#EFF6FF',
  textSecondary: '#BACAD8',
  textMuted: '#7D95AB',
  textLight: '#526478',
  textInverse: '#0D1117',

  // Shadows (for iOS)
  shadow: '#000000',

  // Avatar colors - vivid on dark
  avatarColors: ['#2DD4BF', '#22D3EE', '#FB923C', '#FB7185', '#A78BFA', '#F472B6', '#34D399', '#FCD34D'],
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

