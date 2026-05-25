import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { authAPI, api } from '../api';

// Safe storage wrapper that works on both web and native
const storage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(key);
      }
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
        return;
      }
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.setItem(key, value);
    } catch {}
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
        return;
      }
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.removeItem(key);
    } catch {}
  },
};

interface User {
  id?: string;
  _id?: string;
  ime?: string;
  prezime?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  google_avatar?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (phone: string, pin: string) => Promise<any>;
  register: (data: { phone: string; ime: string; prezime: string; email?: string; pin: string }) => Promise<any>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setUser: (u: User | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  checkAuth: async () => {},
  setUser: () => {},
});

export const useAuth = () => useContext(AuthContext);

async function registerPushToken() {
  if (Platform.OS === 'web') return;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    const finalStatus = existing === 'granted'
      ? existing
      : (await Notifications.requestPermissionsAsync()).status;
    if (finalStatus !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? 'f4f6b981-99bd-4157-a6d3-aafe9d83949a';
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.post('/api/user/push-token', { token });
  } catch {
    // Permission denied or token registration failed — silent fail
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const me = await authAPI.me();
      setUser(me);
      await storage.setItem('user', JSON.stringify(me));
    } catch {
      setUser(null);
      await storage.removeItem('user');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const stored = await storage.getItem('user');
        if (stored) setUser(JSON.parse(stored));
      } catch {}
      await checkAuth();
    })();
  }, [checkAuth]);

  const login = async (phone: string, pin: string) => {
    const result = await authAPI.login(phone, pin);
    const me = result.user || result;
    setUser(me);
    await storage.setItem('user', JSON.stringify(me));
    registerPushToken();
    return result;
  };

  const register = async (data: { phone: string; ime: string; prezime: string; email?: string; pin: string }) => {
    const result = await authAPI.register(data);
    const me = result.user || result;
    setUser(me);
    await storage.setItem('user', JSON.stringify(me));
    registerPushToken();
    return result;
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch {}
    setUser(null);
    await storage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, checkAuth, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}
