import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';
import { Colors, Fonts, Sizes, CardStyle, formatDateShort } from '../../src/theme';
import { profileAPI, authAPI, api } from '../../src/api';
import { useAuth } from '../../src/context/AuthContext';

export default function ProfilScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const s = await profileAPI.stats();
      setStats(s);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  const navigation = useNavigation();
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => { loadData(); });
    return unsub;
  }, [navigation, loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert('Odjava', 'Da li ste sigurni da želite da se odjavite?', [
      { text: 'Ne', style: 'cancel' },
      {
        text: 'Da', style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Brisanje naloga',
      'Da li ste sigurni da želite obrisati svoj nalog? Ova akcija se ne može poništiti.',
      [
        { text: 'Odustani', style: 'cancel' },
        {
          text: 'Obriši nalog',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Potvrda brisanja',
              'Posljednja potvrda — vaš nalog i svi podaci će biti obrisani.',
              [
                { text: 'Odustani', style: 'cancel' },
                {
                  text: 'Da, obriši',
                  style: 'destructive',
                  onPress: async () => {
                    setDeleting(true);
                    try {
                      await api.post('/api/account/archive');
                      await logout();
                      router.replace('/(auth)/login');
                    } catch (e: any) {
                      Alert.alert('Greška', e.message || 'Greška pri brisanju naloga');
                    } finally {
                      setDeleting(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const remaining = stats?.preostali_termini ?? stats?.remaining ?? 0;
  const total = stats?.ukupni_termini ?? stats?.total ?? 0;
  const completed = stats?.zavrseni_treninzi ?? stats?.completed ?? 0;
  const weeks = stats?.sedmice_aktivnosti ?? stats?.weeks ?? 0;

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: 40 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Avatar & Name */}
        <View style={styles.profileHeader} testID="profile-header">
          <View style={styles.avatar}>
            <Feather name="user" size={36} color={Colors.primary} />
          </View>
          <Text style={styles.userName}>{user?.name || [user?.ime, user?.prezime].filter(Boolean).join(' ') || ''}</Text>
          <Text style={styles.userContact}>{user?.email || user?.phone}</Text>
        </View>

        {/* Membership Status */}
        {stats && (total > 0 || stats.pending_paket || stats.ima_aktivnu_clanarinu) && (
          <View style={styles.card} testID="membership-status-card">
            <Text style={styles.cardTitle}>Status članarine</Text>
            {total > 0 ? (
              <>
                <View style={styles.statusRow}>
                  <Feather name="trending-up" size={18} color={Colors.primary} />
                  <Text style={styles.statusText}>
                    Preostalo termina: <Text style={styles.goldBig}>{remaining}</Text>/{total}
                  </Text>
                </View>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, (remaining / (total || 1)) * 100)}%` }]} />
                </View>
              </>
            ) : stats.pending_paket ? (
              <View style={styles.statusRow}>
                <Feather name="clock" size={18} color={Colors.primary} />
                <Text style={styles.statusText}>
                  Paket <Text style={styles.goldBig}>{stats.pending_paket}</Text> čeka aktivaciju
                </Text>
              </View>
            ) : null}
            <View style={styles.statusDetails}>
              <View style={styles.statusDetail}>
                <Feather name="clock" size={14} color={Colors.muted} />
                <Text style={styles.detailText}>Termini važe 30 dana</Text>
              </View>
              {stats.datum_isteka && (
                <View style={styles.statusDetail}>
                  <Feather name="calendar" size={14} color={Colors.muted} />
                  <Text style={styles.detailText}>Važe do: {formatDateShort(stats.datum_isteka)}</Text>
                </View>
              )}
              {stats.datum_pocetka && (
                <View style={styles.statusDetail}>
                  <Feather name="calendar" size={14} color={Colors.muted} />
                  <Text style={styles.detailText}>Početak: {formatDateShort(stats.datum_pocetka)}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard} testID="stat-trainings">
            <Text style={styles.statNumber}>{completed}</Text>
            <Text style={styles.statLabel}>Treninga</Text>
          </View>
          <View style={styles.statCard} testID="stat-weeks">
            <Text style={styles.statNumber}>{weeks}</Text>
            <Text style={styles.statLabel}>Sedmica</Text>
          </View>
        </View>

        {/* Info Card */}
        <View style={styles.card} testID="profile-info-card">
          <Text style={styles.cardTitle}>Informacije</Text>
          {user?.email && (
            <View style={styles.infoRow}>
              <Feather name="mail" size={16} color={Colors.muted} />
              <Text style={styles.infoText}>{user.email}</Text>
            </View>
          )}
          {user?.phone && (
            <View style={styles.infoRow}>
              <Feather name="phone" size={16} color={Colors.muted} />
              <Text style={styles.infoText}>{user.phone}</Text>
            </View>
          )}
          {(stats?.member_since || stats?.clan_od || stats?.created_at || user?.created_at) && (
            <View style={styles.infoRow}>
              <Feather name="calendar" size={16} color={Colors.muted} />
              <Text style={styles.infoText}>Član od {formatDateShort(stats?.member_since || stats?.clan_od || stats?.created_at || user?.created_at)}</Text>
            </View>
          )}
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {user?.is_admin && (
            <TouchableOpacity
              testID="menu-admin-panel"
              style={[styles.menuItem, styles.adminMenuItem]}
              onPress={() => router.push('/(tabs)/admin')}
            >
              <View style={[styles.menuIconWrap, styles.adminIconWrap]}>
                <Feather name="shield" size={18} color={Colors.white} />
              </View>
              <Text style={[styles.menuText, styles.adminMenuText]}>Admin Panel</Text>
              <Feather name="chevron-right" size={20} color={Colors.primary} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            testID="menu-weight"
            style={styles.menuItem}
            onPress={() => router.push('/tezina')}
          >
            <View style={styles.menuIconWrap}>
              <Feather name="activity" size={18} color={Colors.primary} />
            </View>
            <Text style={styles.menuText}>Praćenje težine</Text>
            <Feather name="chevron-right" size={20} color={Colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            testID="menu-notifications"
            style={styles.menuItem}
            onPress={() => router.push('/obavjestenja')}
          >
            <View style={styles.menuIconWrap}>
              <Feather name="bell" size={18} color={Colors.primary} />
            </View>
            <Text style={styles.menuText}>Obavještenja</Text>
            <Feather name="chevron-right" size={20} color={Colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            testID="menu-settings"
            style={styles.menuItem}
            onPress={() => Alert.alert('Uskoro', 'Uskoro dostupno')}
          >
            <View style={styles.menuIconWrap}>
              <Feather name="settings" size={18} color={Colors.primary} />
            </View>
            <Text style={styles.menuText}>Postavke</Text>
            <Feather name="chevron-right" size={20} color={Colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity testID="logout-btn" style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Odjavi se</Text>
        </TouchableOpacity>

        {/* Delete Account */}
        <TouchableOpacity testID="delete-account-btn" style={styles.deleteBtn} onPress={handleDeleteAccount} disabled={deleting}>
          {deleting ? <ActivityIndicator color={Colors.danger} size="small" /> : (
            <Text style={styles.deleteText}>Obriši nalog</Text>
          )}
        </TouchableOpacity>

        {/* Footer */}
        <Text style={styles.footer}>Linea Reformer Pilates v1.1.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 16 },
  profileHeader: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  userName: { fontFamily: Fonts.heading, fontSize: Sizes.h2, color: Colors.foreground, marginBottom: 4 },
  userContact: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.muted },
  card: { ...CardStyle, marginBottom: 16 },
  cardTitle: { fontFamily: Fonts.heading, fontSize: 18, color: Colors.foreground, marginBottom: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  statusText: { fontFamily: Fonts.body, fontSize: Sizes.body, color: Colors.foreground },
  goldBig: { fontFamily: Fonts.heading, fontSize: 24, color: Colors.primary },
  progressBg: { height: 6, backgroundColor: Colors.secondary, borderRadius: 3, overflow: 'hidden', marginBottom: 16 },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  statusDetails: { gap: 8 },
  statusDetail: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.muted },
  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: {
    flex: 1,
    ...CardStyle,
    alignItems: 'center',
    paddingVertical: 20,
  },
  statNumber: { fontFamily: Fonts.heading, fontSize: 36, color: Colors.primary, marginBottom: 4 },
  statLabel: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.muted },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  infoText: { fontFamily: Fonts.body, fontSize: Sizes.body, color: Colors.foreground, flex: 1 },
  menuSection: { marginBottom: 24 },
  menuItem: {
    ...CardStyle,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuText: { flex: 1, fontFamily: Fonts.bodyMedium, fontSize: Sizes.body, color: Colors.foreground },
  adminMenuItem: { borderWidth: 2, borderColor: Colors.primary },
  adminIconWrap: { backgroundColor: Colors.primary },
  adminMenuText: { fontFamily: Fonts.bodyBold, color: Colors.primary },
  logoutBtn: {
    borderWidth: 2,
    borderColor: Colors.danger,
    borderRadius: 9999,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoutText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.body, color: Colors.danger },
  deleteBtn: {
    borderRadius: 9999,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  deleteText: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.muted, textDecorationLine: 'underline' },
  footer: { fontFamily: Fonts.body, fontSize: Sizes.tiny, color: Colors.muted, textAlign: 'center' },
});
