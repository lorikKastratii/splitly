import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Group } from '../types';
import HomeScreen from '../screens/HomeScreen';
import FriendsScreen from '../screens/FriendsScreen';
import ActivityScreen from '../screens/ActivityScreen';
import AccountScreen from '../screens/AccountScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import AddGroupScreen from '../screens/AddGroupScreen';
import AddExpenseScreen from '../screens/AddExpenseScreen';
import EditGroupScreen from '../screens/EditGroupScreen';
import AddFriendScreen from '../screens/AddFriendScreen';
import JoinGroupScreen from '../screens/JoinGroupScreen';
import PaymentScreen from '../screens/PaymentScreen';
import { useTheme } from '../theme/ThemeContext';

// Tab Navigator Types
export type TabParamList = {
  Groups: undefined;
  Friends: undefined;
  Activity: undefined;
  Account: undefined;
};

// Stack Navigator Types
export type RootStackParamList = {
  MainTabs: undefined;
  GroupDetail: { group: Group };
  AddGroup: undefined;
  AddExpense: { groupId: string };
  EditGroup: { groupId: string };
  AddFriend: undefined;
  JoinGroup: undefined;
  Payment: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createStackNavigator<RootStackParamList>();

// Custom Tab Bar Icon component
const TabIcon = ({ name, focused, colors }: { name: string; focused: boolean; colors: any }) => {
  const icons: Record<string, { active: string; inactive: string }> = {
    Groups: { active: '👥', inactive: '👥' },
    Friends: { active: '🤝', inactive: '🤝' },
    Activity: { active: '📊', inactive: '📊' },
    Account: { active: '👤', inactive: '👤' },
  };

  return (
    <View style={[styles.tabIconContainer, focused && { backgroundColor: colors.primaryLight + '30' }]}>
      <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>
        {focused ? icons[name]?.active : icons[name]?.inactive}
      </Text>
    </View>
  );
};

function MainTabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  
  // Calculate proper bottom padding based on device safe area
  const bottomPadding = Math.max(insets.bottom, 10);
  const tabBarHeight = 60 + bottomPadding;
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} colors={colors} />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: bottomPadding,
          paddingHorizontal: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 10,
        },
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      })}
    >
      <Tab.Screen
        name="Groups"
        component={HomeScreen}
        options={{ tabBarLabel: 'Groups' }}
      />
      <Tab.Screen
        name="Friends"
        component={FriendsScreen}
        options={{ tabBarLabel: 'Friends' }}
      />
      <Tab.Screen
        name="Activity"
        component={ActivityScreen}
        options={{ tabBarLabel: 'Activity' }}
      />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{ tabBarLabel: 'Account' }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { colors, isDark } = useTheme();
  
  const navigationTheme = isDark ? {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
    },
  } : {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
    },
  };
  
  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName="MainTabs"
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.primary,
          },
          headerTintColor: colors.textInverse,
          headerTitleStyle: {
            fontWeight: '500',
            fontSize: 18,
          },
          headerBackTitleVisible: false,
          cardStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false, title: '' }}
        />
        <Stack.Screen
          name="GroupDetail"
          component={GroupDetailScreen}
          options={({ route }) => ({ title: route.params.group.name })}
        />
        <Stack.Screen
          name="AddGroup"
          component={AddGroupScreen}
          options={{ title: 'New Group', headerBackTitle: '' }}
        />
        <Stack.Screen
          name="AddExpense"
          component={AddExpenseScreen}
          options={{ title: 'Add Expense', headerBackTitle: '' }}
        />
        <Stack.Screen
          name="EditGroup"
          component={EditGroupScreen}
          options={{ title: 'Edit Group', headerBackTitle: '' }}
        />
        <Stack.Screen
          name="AddFriend"
          component={AddFriendScreen}
          options={{ title: 'Add Friend', headerBackTitle: '' }}
        />
        <Stack.Screen
          name="JoinGroup"
          component={JoinGroupScreen}
          options={{ title: 'Join Group', headerBackTitle: '' }}
        />
        <Stack.Screen
          name="Payment"
          component={PaymentScreen}
          options={{ title: 'Upgrade to Premium', headerBackTitle: '' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    paddingVertical: 5,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
  },
  tabIconContainer: {
    width: 44,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabIcon: {
    fontSize: 22,
    opacity: 0.6,
  },
  tabIconActive: {
    opacity: 1,
  },
});
