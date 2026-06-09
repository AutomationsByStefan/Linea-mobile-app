import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  RefreshControl, ActivityIndicator, Linking, Modal, Alert,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Sizes, Spacing, CardStyle, formatDateWithDay, formatDD, daysUntil } from '../../src/theme';
import { homeAPI, scheduleAPI, trainingAPI, api } from '../../src/api';
import { useAuth } from '../../src/context/AuthContext';
import FeedbackModal from '../../src/components/FeedbackModal';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [memberships, setMemberships] = useState<any[]>([]);
  const [trainings, setTrainings] = useState<any[]>([]);
  const [pastTrainings, setPastTrainings] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingFeedback, setPendingFeedback] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showFeedback, setShowFeedback] = useState(false);

  // Trial booking (Task 3)
  const [trialModal, setTrialModal] = useState(false);
  const [trialSlots, setTrialSlots] = useState<any[]>([]);
  const [trialSlotsLoading, setTrialSlotsLoading] = useState(false);
  const [trialBooking, setTrialBooking] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [mem, tr, notif, fb, req, past] = await Promise.allSettled([
        homeAPI.activeMemberships(),
        homeAPI.upcomingTrainings(),
        homeAPI.unreadNotifications(),
        homeAPI.pendingFeedback(),
        homeAPI.myRequests(),
        trainingAPI.past(),
      ]);
      if (mem.status === 'fulfilled') setMemberships(Array.isArray(mem.value) ? mem.value : []);
      if (tr.status === 'fulfilled') setTrainings(Array.isArray(tr.value) ? tr.value : []);
      if (past.status === 'fulfilled') setPastTrainings(Array.isArray(past.value) ? past.value : []);
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

  const openTrialModal = async () => {
    setTrialModal(true); setTrialSlots([]); setTrialSlotsLoading(true);
    try {
      const data = await scheduleAPI.getSchedule();
      const all = Array.isArray(data) ? data : [];
      const now = new Date();
      const available = all.filter((sl: any) => {
        const dt = new Date(`${sl.datum || sl.date}T${sl.vrijeme || sl.time || '23:59'}`);
        if (isNaN(dt.getTime()) || dt <= now) return false;
        return (sl.slobodna_mjesta ?? sl.available_spots ?? 0) > 0;
      }).sort((a: any, b: any) => {
        const ka = `${a.datum || a.date} ${a.vrijeme || a.time}`;
        const kb = `${b.datum || b.date} ${b.vrijeme || b.time}`;
        return ka.localeCompare(kb);
      });
      setTrialSlots(available);
    } catch (e) { setTrialSlots([]); }
    finally { setTrialSlotsLoading(false); }
  };

  const bookTrial = async (slot: any) => {
    const slotId = slot?.id || slot?._id || slot?.slot_id;
    if (!slotId) {
      Alert.alert('Greška', 'Termin nije moguće identifikovati. Pokušajte ponovo.');
      return;
    }
    setTrialBooking(true);
    try {
      await api.post('/api/bookings/trial', { slot_id: slotId });
      setTrialModal(false);
      Alert.alert('Uspješno', 'Probni trening uspješno zakazan!');
      await loadData();
    } catch (e: any) {
      Alert.alert('Greška', e?.message || 'Nije moguće zakazati probni trening');
    } finally {
      setTrialBooking(false);
    }
  };

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

  const nextTraining = trainings.length > 0
    ? trainings.sort((a: any, b: any) => {
        const da = `${a.datum || a.date}T${a.vrijeme || a.time || '00:00'}`;
        const db = `${b.datum || b.date}T${b.vrijeme || b.time || '00:00'}`;
        return da.localeCompare(db);
      })[0]
    : null;
  const activeMembership = memberships[0];
  const pendingReq = pendingRequests.find((r: any) => r.status === 'pending' || r.status === 'na_cekanju');

  // Task 4 — minus trainings warning
  const minusTrainings = Number(user?.minus_treninzi ?? activeMembership?.minus_treninzi ?? 0) || 0;
  // Task 3 — trial eligibility: no training history and no active membership
  const hasHistory = trainings.length > 0 || pastTrainings.length > 0;
  const showTrialButton = !hasHistory && !activeMembership;

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

        {/* Minus trainings warning (Task 4) */}
        {minusTrainings > 0 && (
          <View style={styles.minusBanner} testID="minus-banner">
            <Feather name="alert-triangle" size={20} color={Colors.danger} />
            <Text style={styles.minusBannerText}>
              Imate {minusTrainings} trening(a) u minusu. Potrebna je uplata.
            </Text>
          </View>
        )}

        {/* Free trial training for new users (Task 3) */}
        {showTrialButton && (
          <TouchableOpacity
            testID="trial-book-btn"
            style={styles.trialCard}
            activeOpacity={0.85}
            onPress={openTrialModal}
          >
            <View style={styles.trialIcon}>
              <Feather name="gift" size={24} color={Colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.trialTitle}>Zakaži besplatan probni trening</Text>
              <Text style={styles.trialSubtitle}>Isprobaj svoj prvi trening bez obaveza</Text>
            </View>
            <Feather name="chevron-right" size={22} color={Colors.white} />
          </TouchableOpacity>
        )}

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
                <View style={[styles.memberBadge,
                  (activeMembership.tip === 'aktivna') ? styles.memberBadgeActive : styles.memberBadgeExpired]}>
                  <Text style={[styles.memberBadgeText,
                    (activeMembership.tip === 'aktivna') ? styles.memberBadgeTextActive : styles.memberBadgeTextExpired]}>
                    {activeMembership.tip === 'aktivna' ? 'Aktivna' : 'Istekla'}
                  </Text>
                </View>
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
              {(() => {
                const start = activeMembership.datum_pocetka || activeMembership.start_date;
                const expiry = activeMembership.datum_isteka || activeMembership.expiry_date || activeMembership.expiry;
                const left = daysUntil(expiry);
                const isExpired = activeMembership.tip === 'istekla' || (left != null && left < 0);
                return (
                  <View style={styles.membershipDates}>
                    {start && (
                      <Text style={styles.membershipDateText}>Početak paketa: {formatDD(start)}</Text>
                    )}
                    {expiry && (isExpired ? (
                      <Text style={styles.membershipExpiredText}>Paket je istekao {formatDD(expiry)}</Text>
                    ) : (
                      <>
                        <Text style={styles.membershipDateText}>Paket važi do: {formatDD(expiry)}</Text>
                        {left != null && <Text style={styles.membershipDaysLeft}>Preostalo {left} dana</Text>}
                      </>
                    ))}
                  </View>
                );
              })()}
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
                    {formatDateWithDay(nextTraining.datum || nextTraining.date)}
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

      {/* Trial Booking Modal (Task 3) */}
      <Modal visible={trialModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Probni trening</Text>
              <TouchableOpacity onPress={() => setTrialModal(false)}>
                <Feather name="x" size={22} color={Colors.foreground} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>Izaberite termin za svoj besplatan probni trening</Text>
            {trialSlotsLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 24 }} />
            ) : trialSlots.length === 0 ? (
              <Text style={styles.emptyText}>Nema dostupnih termina</Text>
            ) : (
              <ScrollView style={{ maxHeight: 380, marginVertical: 8 }}>
                {trialSlots.map((sl: any) => {
                  const sid = sl.id || sl._id || sl.slot_id;
                  const free = sl.slobodna_mjesta ?? sl.available_spots ?? 0;
                  const total = sl.ukupno_mjesta ?? sl.total_spots ?? 3;
                  return (
                    <TouchableOpacity
                      key={sid}
                      style={styles.trialSlot}
                      disabled={trialBooking}
                      onPress={() => bookTrial(sl)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.trialSlotDate}>{formatDateWithDay(sl.datum || sl.date)}</Text>
                        <Text style={styles.trialSlotTime}>{sl.vrijeme || sl.time} • {free}/{total} slobodno</Text>
                      </View>
                      <Feather name="chevron-right" size={20} color={Colors.primary} />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            {trialBooking && <ActivityIndicator color={Colors.primary} style={{ marginTop: 8 }} />}
          </View>
        </View>
      </Modal>

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
  membershipRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  membershipName: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.body, color: Colors.foreground },
  memberBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  memberBadgeActive: { backgroundColor: 'rgba(40,167,69,0.15)' },
  memberBadgeExpired: { backgroundColor: 'rgba(220,53,69,0.15)' },
  memberBadgeText: { fontFamily: Fonts.bodySemiBold, fontSize: 11 },
  memberBadgeTextActive: { color: Colors.success },
  memberBadgeTextExpired: { color: Colors.danger },
  membershipTerms: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.foreground, marginBottom: 12 },
  goldText: { fontFamily: Fonts.bodyBold, color: Colors.primary },
  membershipDates: { marginTop: 12, gap: 2 },
  membershipDateText: { fontFamily: Fonts.bodyMedium, fontSize: Sizes.small, color: Colors.foreground },
  membershipDaysLeft: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.small, color: Colors.primary },
  membershipExpiredText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.small, color: Colors.danger },
  // Minus warning banner (Task 4)
  minusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(220,53,69,0.1)',
    borderWidth: 1, borderColor: Colors.danger,
    borderRadius: 16, padding: 16, marginBottom: 20,
  },
  minusBannerText: { flex: 1, fontFamily: Fonts.bodySemiBold, fontSize: Sizes.small, color: Colors.danger },
  // Trial card (Task 3)
  trialCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.primary, borderRadius: 20, padding: 18, marginBottom: 24,
    shadowColor: 'rgba(166, 139, 91, 0.4)', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1, shadowRadius: 16, elevation: 4,
  },
  trialIcon: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center',
  },
  trialTitle: { fontFamily: Fonts.bodyBold, fontSize: Sizes.body, color: Colors.white, marginBottom: 2 },
  trialSubtitle: { fontFamily: Fonts.body, fontSize: Sizes.tiny, color: 'rgba(255,255,255,0.85)' },
  // Trial modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: Colors.cardBg, borderRadius: 24, padding: 24, width: '100%', maxWidth: 420 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontFamily: Fonts.heading, fontSize: 18, color: Colors.foreground },
  modalHint: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.muted, marginBottom: 8 },
  trialSlot: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.secondary, borderRadius: 14, padding: 14, marginBottom: 8,
  },
  trialSlotDate: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.small, color: Colors.foreground },
  trialSlotTime: { fontFamily: Fonts.body, fontSize: Sizes.tiny, color: Colors.muted, marginTop: 2 },
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
