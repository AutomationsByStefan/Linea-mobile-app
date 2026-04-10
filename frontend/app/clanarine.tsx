import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Sizes, CardStyle, formatDateShort } from '../src/theme';
import { membershipsAPI } from '../src/api';

export default function ClanarineScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [data, setData] = useState<any>({ active: [], past: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await membershipsAPI.getAll();
      if (Array.isArray(res)) {
        const active = res.filter((m: any) => m.active || m.aktivna || m.status === 'active');
        const past = res.filter((m: any) => !m.active && !m.aktivna && m.status !== 'active');
        setData({ active, past });
      } else {
        setData({ active: res.active || res.aktivne || [], past: res.past || res.prethodne || [] });
      }
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

  const MembershipCard = ({ m, isPast }: { m: any; isPast: boolean }) => {
    const name = m.package_name || m.naziv;
    const remaining = m.preostali_termini ?? m.remaining ?? 0;
    const total = m.ukupni_termini ?? m.total ?? 0;
    const expiry = m.datum_isteka || m.expiry_date;

    return (
      <View style={[styles.card, isPast && styles.cardPast]} testID={`membership-${name}`}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardName}>{name}</Text>
          <View style={[styles.statusBadge, isPast ? styles.statusExpired : styles.statusActive]}>
            <Text style={[styles.statusText, isPast ? styles.statusExpiredText : styles.statusActiveText]}>
              {isPast ? 'Istekla' : 'Aktivna'}
            </Text>
          </View>
        </View>
        <Text style={styles.cardTerms}>
          {isPast ? 'Iskorišteno' : 'Preostalo'}: <Text style={styles.goldText}>{remaining}</Text>/{total} termina
        </Text>
        {expiry && (
          <Text style={styles.cardExpiry}>
            {isPast ? 'Istekla' : 'Važi do'}: {formatDateShort(expiry)}
          </Text>
        )}
        {!isPast && (
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${Math.min(100, (remaining / (total || 1)) * 100)}%` }]} />
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity testID="clanarine-back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tvoje članarine</Text>
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
            {data.active.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Aktivne članarine</Text>
                {data.active.map((m: any, i: number) => (
                  <MembershipCard key={m.id || m._id || i} m={m} isPast={false} />
                ))}
              </View>
            )}

            {data.past.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Prethodne članarine</Text>
                {data.past.map((m: any, i: number) => (
                  <MembershipCard key={m.id || m._id || i} m={m} isPast={true} />
                ))}
              </View>
            )}

            {data.active.length === 0 && data.past.length === 0 && (
              <View style={styles.emptyWrap}>
                <Feather name="credit-card" size={40} color={Colors.muted} />
                <Text style={styles.emptyText}>Nemate članarina</Text>
              </View>
            )}
          </>
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
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  section: { marginBottom: 24 },
  sectionTitle: { fontFamily: Fonts.heading, fontSize: 18, color: Colors.foreground, marginBottom: 12 },
  card: { ...CardStyle, marginBottom: 12 },
  cardPast: { opacity: 0.7 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardName: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.body, color: Colors.foreground },
  statusBadge: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  statusActive: { backgroundColor: 'rgba(40,167,69,0.1)' },
  statusExpired: { backgroundColor: 'rgba(136,136,136,0.1)' },
  statusText: { fontFamily: Fonts.bodySemiBold, fontSize: 11 },
  statusActiveText: { color: Colors.success },
  statusExpiredText: { color: Colors.muted },
  cardTerms: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.foreground, marginBottom: 4 },
  goldText: { fontFamily: Fonts.bodyBold, color: Colors.primary },
  cardExpiry: { fontFamily: Fonts.body, fontSize: Sizes.tiny, color: Colors.muted, marginBottom: 12 },
  progressBg: { height: 6, backgroundColor: Colors.secondary, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.muted },
});
