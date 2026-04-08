import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { Colors, Fonts } from '../../src/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isAdmin = user?.is_admin === true;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.muted,
        tabBarLabelStyle: {
          fontFamily: Fonts.bodySemiBold,
          fontSize: 11,
          marginTop: -2,
        },
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          height: 60 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 8,
          ...Platform.select({
            ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: -4 } },
            android: { elevation: 8 },
          }),
        },
        tabBarItemStyle: { paddingVertical: 4 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Početna',
          tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="termini"
        options={{
          title: 'Termini',
          tabBarIcon: ({ color }) => <Feather name="calendar" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="paketi"
        options={{
          title: 'Paketi',
          tabBarIcon: ({ color }) => <Feather name="credit-card" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          tabBarIcon: ({ color }) => <Feather name="shield" size={22} color={color} />,
          href: isAdmin ? '/(tabs)/admin' : null,
        }}
      />
    </Tabs>
  );
}
