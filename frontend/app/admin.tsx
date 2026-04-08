import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Sizes, CardStyle } from '../src/theme';
import { api } from '../src/api';
import { useAuth } from '../src/context/AuthContext';

export default function AdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [stats, setStats] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [reqRes, usersRes] = await Promise.allSettled([
        api.get('/api/admin/package-requests'),
        api.get('/api/admin/stats'),
      ]);
      if (reqRes.status === 'fulfilled') setRequests(Array.isArray(reqRes.value) ? reqRes.value : []);
      if (usersRes.status === 'fulfilled') setStats(usersRes.value);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleApprove = async (requestId: string) => {
    try {
      await api.post(`/api/admin/package-requests/${requestId}/approve`);
      await loadData();
    } catch (e: any) {
      console.error(e);
    }
  };

  if (!user?.is_admin) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Feather name="shield-off" size={48} color={Colors.muted} />
        <Text style={styles.emptyText}>Nemate pristup admin panelu</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.linkText}>Nazad</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pendingRequests = requests.filter((r: any) => r.status === 'pending');

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity testID="admin-back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Panel</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Stats */}
            {stats && (
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{stats.total_users || 0}</Text>
                  <Text style={styles.statLabel}>Korisnika</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{stats.active_memberships || 0}</Text>
                  <Text style={styles.statLabel}>Aktivnih</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{pendingRequests.length}</Text>
                  <Text style={styles.statLabel}>Na čekanju</Text>
                </View>
              </View>
            )}

            {/* Pending Requests */}
            <Text style={styles.sectionTitle}>Zahtjevi za pakete</Text>
            {pendingRequests.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>Nema zahtjeva na čekanju</Text>
              </View>
            ) : (
              pendingRequests.map((req: any) => (
                <View key={req.id} style={styles.card} testID={`request-${req.id}`}>
                  <View style={styles.reqHeader}>
                    <Text style={styles.reqName}>{req.user_name}</Text>
                    <Text style={styles.reqPhone}>{req.user_phone}</Text>
                  </View>
                  <Text style={styles.reqPackage}>{req.package_name} — {req.package_price} KM</Text>
                  <Text style={styles.reqSessions}>{req.package_sessions} termina</Text>
                  <TouchableOpacity
                    testID={`approve-${req.id}`}
                    style={styles.approveBtn}
                    onPress={() => handleApprove(req.id)}
                  >
                    <Feather name="check" size={16} color={Colors.white} />
                    <Text style={styles.approveBtnText}>Odobri</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}

            {/* All Requests */}
            {requests.filter((r: any) => r.status !== 'pending').length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Obrađeni zahtjevi</Text>
                {requests.filter((r: any) => r.status !== 'pending').map((req: any) => (
                  <View key={req.id} style={[styles.card, styles.cardProcessed]} testID={`processed-${req.id}`}>
                    <View style={styles.reqHeader}>
                      <Text style={styles.reqName}>{req.user_name}</Text>
                      <View style={[styles.statusBadge, req.status === 'approved' ? styles.badgeApproved : styles.badgeRejected]}>
                        <Text style={styles.statusBadgeText}>
                          {req.status === 'approved' ? 'Odobreno' : req.status}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.reqPackage}>{req.package_name}</Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, gap: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.heading, fontSize: Sizes.h3, color: Colors.foreground },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1,
    ...CardStyle,
    alignItems: 'center',
    paddingVertical: 16,
  },
  statNumber: { fontFamily: Fonts.heading, fontSize: 28, color: Colors.primary, marginBottom: 4 },
  statLabel: { fontFamily: Fonts.body, fontSize: Sizes.tiny, color: Colors.muted },
  sectionTitle: { fontFamily: Fonts.heading, fontSize: 18, color: Colors.foreground, marginBottom: 12 },
  card: { ...CardStyle, marginBottom: 12 },
  cardProcessed: { opacity: 0.7 },
  emptyCard: { ...CardStyle, alignItems: 'center', paddingVertical: 30 },
  emptyText: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.muted, textAlign: 'center' },
  reqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reqName: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.body, color: Colors.foreground },
  reqPhone: { fontFamily: Fonts.body, fontSize: Sizes.tiny, color: Colors.muted },
  reqPackage: { fontFamily: Fonts.bodyMedium, fontSize: Sizes.small, color: Colors.primary, marginBottom: 4 },
  reqSessions: { fontFamily: Fonts.body, fontSize: Sizes.tiny, color: Colors.muted, marginBottom: 12 },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 9999,
    height: 40,
  },
  approveBtnText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.small, color: Colors.white },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  badgeApproved: { backgroundColor: 'rgba(40,167,69,0.1)' },
  badgeRejected: { backgroundColor: 'rgba(220,53,69,0.1)' },
  statusBadgeText: { fontFamily: Fonts.bodySemiBold, fontSize: 10, color: Colors.foreground },
  backLink: { paddingVertical: 12 },
  linkText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.body, color: Colors.primary },
});
