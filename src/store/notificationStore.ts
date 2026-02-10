import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateId } from '../lib/utils';

export interface Notification {
  id: string;
  type: 'expense_added' | 'settlement' | 'member_joined' | 'group_created';
  title: string;
  message: string;
  groupId?: string;
  groupName?: string;
  createdAt: string;
  read: boolean;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  
  loadNotifications: () => Promise<void>;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  
  loadNotifications: async () => {
    try {
      const data = await AsyncStorage.getItem('notifications');
      if (data) {
        const notifications = JSON.parse(data) as Notification[];
        const unreadCount = notifications.filter((n) => !n.read).length;
        set({ notifications, unreadCount });
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  },
  
  addNotification: (notification) => {
    const newNotification: Notification = {
      ...notification,
      id: generateId(),
      createdAt: new Date().toISOString(),
      read: false,
    };
    
    set((state) => {
      const notifications = [newNotification, ...state.notifications].slice(0, 50); // Keep last 50
      AsyncStorage.setItem('notifications', JSON.stringify(notifications));
      return {
        notifications,
        unreadCount: state.unreadCount + 1,
      };
    });
  },
  
  markAsRead: (id) => {
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      const unreadCount = notifications.filter((n) => !n.read).length;
      AsyncStorage.setItem('notifications', JSON.stringify(notifications));
      return { notifications, unreadCount };
    });
  },
  
  markAllAsRead: () => {
    set((state) => {
      const notifications = state.notifications.map((n) => ({ ...n, read: true }));
      AsyncStorage.setItem('notifications', JSON.stringify(notifications));
      return { notifications, unreadCount: 0 };
    });
  },
  
  clearNotifications: () => {
    AsyncStorage.removeItem('notifications');
    set({ notifications: [], unreadCount: 0 });
  },
}));
