import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Fonts, Sizes, CardStyle } from '../src/theme';
import { notificationsAPI } from '../src/api';

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Upravo';
  if (mins < 60) return `Prije ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Prije ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Prije ${days} dana`;
}

function getIcon(type: string): string {
  if (type?.includes('training') || type?.includes('trening')) return 'calendar';
  if (type?.includes('check') || type?.includes('potvrda')) return 'check-circle';
  return 'bell';
}

export default function ObavjestenjaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await notificationsAPI.getAll();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleRead = async (id: string) => {
    try {
      await notificationsAPI.markRead(id);
      setNotifications(prev => prev.map(n =>
        (n.id === id || n._id === id) ? { ...n, read: true, procitano: true } : n
      ));
    } catch (e) { console.error(e); }
  };

  const handleReadAll = async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true, procitano: true })));
    } catch (e) { console.error(e); }
  };

  const hasUnread = notifications.some(n => !n.read && !n.procitano);

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity testID="obavjestenja-back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Obavještenja</Text>
        {hasUnread ? (
          <TouchableOpacity testID="mark-all-read-btn" onPress={handleReadAll}>
            <Text style={styles.markAll}>Označi sve</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 80 }} />}
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
        ) : notifications.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Feather name="bell" size={40} color={Colors.muted} />
            <Text style={styles.emptyText}>Nema obavještenja</Text>
          </View>
        ) : (
          notifications.map((n: any) => {
            const id = n.id || n._id;
            const isUnread = !n.read && !n.procitano;
            const icon = getIcon(n.type || n.tip);

            return (
              <TouchableOpacity
                key={id}
                testID={`notification-${id}`}
                style={[styles.notifCard, isUnread && styles.notifUnread]}
                onPress={() => isUnread && handleRead(id)}
                activeOpacity={isUnread ? 0.7 : 1}
              >
                <View style={[styles.notifIcon, isUnread ? styles.notifIconUnread : styles.notifIconRead]}>
                  <Feather name={icon as any} size={18} color={isUnread ? Colors.primary : Colors.muted} />
                </View>
                <View style={styles.notifContent}>
                  <Text style={[styles.notifTitle, isUnread && styles.notifTitleBold]}>
                    {n.title || n.naslov}
                  </Text>
                  <Text style={styles.notifMessage}>{n.message || n.poruka}</Text>
                  <Text style={styles.notifTime}>
                    {timeAgo(n.created_at || n.datum || new Date().toISOString())}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.heading, fontSize: Sizes.h3, color: Colors.foreground },
  markAll: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.small, color: Colors.primary },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  notifCard: {
    ...CardStyle,
    marginBottom: 10,
    flexDirection: 'row',
    gap: 12,
  },
  notifUnread: { borderLeftWidth: 4, borderLeftColor: Colors.primary },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifIconUnread: { backgroundColor: Colors.secondary },
  notifIconRead: { backgroundColor: Colors.background },
  notifContent: { flex: 1 },
  notifTitle: { fontFamily: Fonts.bodyMedium, fontSize: Sizes.small, color: Colors.foreground, marginBottom: 4 },
  notifTitleBold: { fontFamily: Fonts.bodyBold },
  notifMessage: { fontFamily: Fonts.body, fontSize: Sizes.tiny, color: Colors.muted, marginBottom: 4 },
  notifTime: { fontFamily: Fonts.body, fontSize: Sizes.xs, color: Colors.muted },
  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.muted },
});
