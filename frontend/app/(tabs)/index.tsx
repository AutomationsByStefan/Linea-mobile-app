import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  RefreshControl, ActivityIndicator, Linking,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Sizes, Spacing, CardStyle, formatDateBosnian } from '../../src/theme';
import { homeAPI } from '../../src/api';
import { useAuth } from '../../src/context/AuthContext';
import FeedbackModal from '../../src/components/FeedbackModal';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [memberships, setMemberships] = useState<any[]>([]);
  const [trainings, setTrainings] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingFeedback, setPendingFeedback] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showFeedback, setShowFeedback] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [mem, tr, notif, fb, req] = await Promise.allSettled([
        homeAPI.activeMemberships(),
        homeAPI.upcomingTrainings(),
        homeAPI.unreadNotifications(),
        homeAPI.pendingFeedback(),
        homeAPI.myRequests(),
      ]);
      if (mem.status === 'fulfilled') setMemberships(Array.isArray(mem.value) ? mem.value : []);
      if (tr.status === 'fulfilled') setTrainings(Array.isArray(tr.value) ? tr.value : []);
      if (notif.status === 'fulfilled') {
        const val = notif.value;
        setUnreadCount(typeof val === 'number' ? val : Array.isArray(val) ? val.length : val?.count || 0);
      }
      if (fb.status === 'fulfilled') {
        const fbArr = Array.isArray(fb.value) ? fb.value : [];
        setPendingFeedback(fbArr);
        if (fbArr.length > 0) setTimeout(() => setShowFeedback(true), 2000);
      }
      if (req.status === 'fulfilled') setPendingRequests(Array.isArray(req.value) ? req.value : []);
    } catch (e) {
      console.error('Home load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch data on tab focus (cross-screen refresh)
  const navigation = useNavigation();
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => { loadData(); });
    return unsubscribe;
  }, [navigation, loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const nextTraining = trainings[0];
  const activeMembership = memberships[0];
  const pendingReq = pendingRequests.find((r: any) => r.status === 'pending' || r.status === 'na_cekanju');

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Hero Card */}
        <View style={styles.heroCard} testID="home-hero-card">
          <View style={styles.heroTop}>
            <View style={styles.heroTextWrap}>
              <Text style={styles.heroTitle}>Zdravo, {user?.name || user?.ime || 'Korisnik'}</Text>
              <Text style={styles.heroSubtitle}>Vrijeme je da rezervišeš naredni trening?</Text>
            </View>
            <TouchableOpacity
              testID="notifications-btn"
              style={styles.bellBtn}
              onPress={() => router.push('/obavjestenja')}
            >
              <Feather name="bell" size={22} color={Colors.white} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            testID="hero-book-btn"
            style={styles.heroBtn}
            onPress={() => router.push('/(tabs)/termini')}
          >
            <Text style={styles.heroBtnText}>Rezerviši termin</Text>
          </TouchableOpacity>
        </View>

        {/* Active Memberships */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Aktivne članarine</Text>
            <TouchableOpacity testID="memberships-see-all" onPress={() => router.push('/clanarine')}>
              <Text style={styles.seeAll}>Vidi sve {'>'}</Text>
            </TouchableOpacity>
          </View>
          {pendingReq && (
            <View style={[styles.card, styles.pendingCard]}>
              <Feather name="clock" size={18} color={Colors.primary} />
              <Text style={styles.pendingText}>Vaš paket čeka aktivaciju nakon uplate</Text>
            </View>
          )}
          {activeMembership ? (
            <View style={styles.card} testID="active-membership-card">
              <View style={styles.membershipRow}>
                <Text style={styles.membershipName}>{activeMembership.package_name || activeMembership.naziv}</Text>
                <Text style={styles.membershipExpiry}>
                  {activeMembership.datum_isteka ? formatDateBosnian(activeMembership.datum_isteka) : ''}
                </Text>
              </View>
              <Text style={styles.membershipTerms}>
                Preostalo termina: <Text style={styles.goldText}>
                  {activeMembership.preostali_termini ?? activeMembership.remaining ?? 0}
                </Text>
                /{activeMembership.ukupni_termini ?? activeMembership.total ?? 0}
              </Text>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, {
                  width: `${Math.min(100, ((activeMembership.preostali_termini ?? activeMembership.remaining ?? 0) /
                    (activeMembership.ukupni_termini ?? activeMembership.total ?? 1)) * 100)}%`
                }]} />
              </View>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.emptyText}>Trenutno nemate aktivnih članarina</Text>
              <TouchableOpacity
                testID="go-packages-btn"
                style={styles.secondaryBtn}
                onPress={() => router.push('/(tabs)/paketi')}
              >
                <Text style={styles.secondaryBtnText}>Pogledaj pakete</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Upcoming Training */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Predstojeći trening</Text>
            <TouchableOpacity testID="trainings-see-all" onPress={() => router.push('/treninzi')}>
              <Text style={styles.seeAll}>Vidi sve {'>'}</Text>
            </TouchableOpacity>
          </View>
          {nextTraining ? (
            <View style={styles.card} testID="upcoming-training-card">
              <View style={styles.trainingRow}>
                <View style={styles.trainingIcon}>
                  <Feather name="calendar" size={22} color={Colors.white} />
                </View>
                <View style={styles.trainingInfo}>
                  <Text style={styles.trainingDate}>
                    {formatDateBosnian(nextTraining.datum || nextTraining.date)}
                  </Text>
                  <View style={styles.timeRow}>
                    <Feather name="clock" size={14} color={Colors.muted} />
                    <Text style={styles.trainingTime}>{nextTraining.vrijeme || nextTraining.time}</Text>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.emptyText}>Trenutno nemate izabranih termina</Text>
              <TouchableOpacity
                testID="go-schedule-btn"
                style={styles.secondaryBtn}
                onPress={() => router.push('/(tabs)/termini')}
              >
                <Text style={styles.secondaryBtnText}>Zakaži trening</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Contact Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kontakt informacije</Text>
          <TouchableOpacity
            testID="contact-phone"
            style={styles.card}
            onPress={() => Linking.openURL('tel:+38766024148')}
          >
            <View style={styles.contactRow}>
              <View style={styles.contactIcon}>
                <Feather name="phone" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.contactText}>+387 66 024 148</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            testID="contact-instagram"
            style={styles.card}
            onPress={() => Linking.openURL('https://instagram.com/lineapilatesreformer')}
          >
            <View style={styles.contactRow}>
              <View style={styles.contactIcon}>
                <Feather name="instagram" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.contactText}>@lineapilatesreformer</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            testID="contact-address"
            style={styles.card}
            onPress={() => Linking.openURL('https://www.google.com/maps?q=42.712313,18.3414666')}
          >
            <View style={styles.contactRow}>
              <View style={styles.contactIcon}>
                <Feather name="map-pin" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.contactText}>Kralja Petra I Oslobodioca 55, 89101 Trebinje</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Feedback Modal */}
      {showFeedback && pendingFeedback.length > 0 && (
        <FeedbackModal
          training={pendingFeedback[0]}
          visible={showFeedback}
          onClose={() => setShowFeedback(false)}
          onSubmitted={() => {
            setShowFeedback(false);
            setPendingFeedback(prev => prev.slice(1));
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  content: { paddingHorizontal: 16 },
  heroCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    backgroundColor: Colors.primary,
    overflow: 'hidden',
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  heroTextWrap: { flex: 1, marginRight: 16 },
  heroTitle: { fontFamily: Fonts.heading, fontSize: 24, color: Colors.white, marginBottom: 4 },
  heroSubtitle: { fontFamily: Fonts.body, fontSize: Sizes.small, color: 'rgba(255,255,255,0.8)' },
  bellBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: Colors.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontFamily: Fonts.bodyBold, fontSize: 10, color: Colors.white },
  heroBtn: {
    backgroundColor: Colors.white,
    borderRadius: 9999,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroBtnText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.small, color: Colors.primary },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontFamily: Fonts.heading, fontSize: Sizes.h3, color: Colors.foreground },
  seeAll: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.small, color: Colors.primary },
  card: {
    ...CardStyle,
    marginBottom: 12,
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.secondary,
    borderColor: Colors.primary,
  },
  pendingText: { fontFamily: Fonts.bodyMedium, fontSize: Sizes.small, color: Colors.foreground, flex: 1 },
  membershipRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  membershipName: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.body, color: Colors.foreground },
  membershipExpiry: { fontFamily: Fonts.body, fontSize: Sizes.tiny, color: Colors.muted },
  membershipTerms: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.foreground, marginBottom: 12 },
  goldText: { fontFamily: Fonts.bodyBold, color: Colors.primary },
  progressBg: {
    height: 6,
    backgroundColor: Colors.secondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  emptyText: {
    fontFamily: Fonts.body,
    fontSize: Sizes.small,
    color: Colors.muted,
    textAlign: 'center',
    marginBottom: 12,
  },
  secondaryBtn: {
    backgroundColor: Colors.secondary,
    borderRadius: 9999,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 24,
  },
  secondaryBtnText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.small, color: Colors.foreground },
  trainingRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  trainingIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trainingInfo: { flex: 1 },
  trainingDate: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.body, color: Colors.foreground, marginBottom: 4 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trainingTime: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.muted },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactText: { fontFamily: Fonts.bodyMedium, fontSize: Sizes.small, color: Colors.foreground, flex: 1 },
});
