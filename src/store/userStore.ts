import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserProfile {
  name: string;
  email?: string;
  avatarUri?: string;
}

interface UserState {
  profile: UserProfile;
  isLoading: boolean;
  
  loadProfile: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  setAvatarUri: (uri: string | undefined) => Promise<void>;
}

const DEFAULT_PROFILE: UserProfile = {
  name: 'Me',
  email: undefined,
  avatarUri: undefined,
};

export const useUserStore = create<UserState>((set, get) => ({
  profile: DEFAULT_PROFILE,
  isLoading: true,
  
  loadProfile: async () => {
    try {
      const profileData = await AsyncStorage.getItem('userProfile');
      if (profileData) {
        set({ profile: JSON.parse(profileData), isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      set({ isLoading: false });
    }
  },
  
  updateProfile: async (updates) => {
    try {
      const { profile } = get();
      const newProfile = { ...profile, ...updates };
      await AsyncStorage.setItem('userProfile', JSON.stringify(newProfile));
      set({ profile: newProfile });
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  },
  
  setAvatarUri: async (uri) => {
    try {
      const { profile } = get();
      const newProfile = { ...profile, avatarUri: uri };
      await AsyncStorage.setItem('userProfile', JSON.stringify(newProfile));
      set({ profile: newProfile });
    } catch (error) {
      console.error('Error setting avatar:', error);
    }
  },
}));
