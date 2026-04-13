import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  RefreshControl, ActivityIndicator, Modal, Alert, Share, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';
import Svg, { Path, Rect } from 'react-native-svg';
import { Colors, Fonts, Sizes, CardStyle, BosnianDaysShort, formatDateBosnian } from '../../src/theme';
import { scheduleAPI, trainingAPI } from '../../src/api';

// Reformer bed SVG icon
function BedIcon({ filled = false, size = 20 }: { filled?: boolean; size?: number }) {
  const color = filled ? Colors.primary : Colors.border;
  return (
    <Svg width={size} height={size * 0.5} viewBox="0 0 40 20">
      <Rect x="2" y="10" width="36" height="4" rx="2" fill={color} />
      <Rect x="6" y="4" width="6" height="6" rx="1.5" fill={color} />
      <Rect x="15" y="4" width="6" height="6" rx="1.5" fill={color} />
      <Rect x="24" y="4" width="6" height="6" rx="1.5" fill={color} />
      <Rect x="4" y="14" width="3" height="4" rx="1" fill={color} />
      <Rect x="33" y="14" width="3" height="4" rx="1" fill={color} />
    </Svg>
  );
}

function getWorkingDays(count: number): Date[] {
  const days: Date[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (days.length < count) {
    if (d.getDay() !== 0) days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function TerminiScreen() {
  const insets = useSafeAreaInsets();
  const workingDays = useMemo(() => getWorkingDays(10), []);

  const [selectedDate, setSelectedDate] = useState(workingDays[0]);
  const [slots, setSlots] = useState<any[]>([]);
  const [myTrainings, setMyTrainings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [booking, setBooking] = useState(false);
  const [confirmSlot, setConfirmSlot] = useState<any>(null);
  const [shareInfo, setShareInfo] = useState<any>(null);

  const loadData = useCallback(async () => {
    try {
      const [sched, upcoming] = await Promise.allSettled([
        scheduleAPI.getSchedule(),
        trainingAPI.upcoming(),
      ]);
      if (sched.status === 'fulfilled') setSlots(Array.isArray(sched.value) ? sched.value : []);
      if (upcoming.status === 'fulfilled') setMyTrainings(Array.isArray(upcoming.value) ? upcoming.value : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  // Re-fetch on tab focus
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

  const dateStr = toDateStr(selectedDate);
  const now = new Date();
  const currentHour = now.getHours();
  const isToday = toDateStr(now) === dateStr;

  const daySlots = slots.filter((s: any) => {
    const sDatum = s.datum || s.date;
    return sDatum === dateStr;
  }).filter((s: any) => {
    if (!isToday) return true;
    const hour = parseInt((s.vrijeme || s.time || '0').split(':')[0], 10);
    return hour > currentHour;
  }).sort((a: any, b: any) => (a.vrijeme || a.time || '').localeCompare(b.vrijeme || b.time || ''));

  const myBookingToday = myTrainings.find((t: any) => (t.datum || t.date) === dateStr);

  const handleBook = async (slot: any) => {
    setBooking(true);
    try {
      const res = await scheduleAPI.book({
        slot_id: slot.id || slot._id || slot.slot_id,
        datum: slot.datum || slot.date || dateStr,
        vrijeme: slot.vrijeme || slot.time,
        instruktor: slot.instruktor || slot.instructor || 'Marija Trisic',
      });
      setConfirmSlot(null);

      if (res.is_trial) {
        // Trial handled by admin — no special UI for users
      }
      
      const free = (slot.slobodna_mjesta || slot.available_spots || 0) - 1;
      // Only show share if there are still spots left after this booking
      if (free > 0) {
        setShareInfo({ training_id: res.training_id, slot });
      }

      await loadData();
    } catch (e: any) {
      Alert.alert('Greška', e.message || 'Nije moguće rezervisati termin');
    } finally {
      setBooking(false);
    }
  };

  const handleShare = async () => {
    if (!shareInfo) return;
    try {
      const res = await scheduleAPI.share(shareInfo.training_id);
      const shareLink = res.share_link || res.link || 'https://lineapilates.com';
      await Share.share({
        message: `Pridruži mi se na Pilates Reformer treningu! 💪\n\n${shareLink}`,
        title: 'Poziv na trening - Linea Pilates',
      });
    } catch (e: any) {
      console.error(e);
    }
    setShareInfo(null);
  };

  // Slot card with bed icons
  const SlotCard = ({ slot }: { slot: any }) => {
    const vrijeme = slot.vrijeme || slot.time;
    const total = slot.ukupno_mjesta || slot.total_spots || 3;
    const free = slot.slobodna_mjesta || slot.available_spots || 0;
    const occupied = total - free;
    const isFull = free <= 0;

    return (
      <TouchableOpacity
        testID={`slot-${vrijeme}`}
        style={[st.slotCard, isFull && st.slotCardFull]}
        onPress={() => !isFull && setConfirmSlot(slot)}
        disabled={isFull}
        activeOpacity={0.7}
      >
        <Text style={[st.slotTime, isFull && st.slotTimeFull]}>{vrijeme}</Text>
        <View style={st.bedRow}>
          {Array.from({ length: total }).map((_, i) => (
            <BedIcon key={i} filled={i >= occupied} size={22} />
          ))}
        </View>
        {isFull && <Text style={st.slotFullLabel}>Puno</Text>}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[st.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={st.flex}>
      <ScrollView
        style={st.flex}
        contentContainerStyle={[st.content, { paddingTop: insets.top + 8, paddingBottom: 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <Text style={st.pageTitle}>Rezerviši termin</Text>
        <Text style={st.pageSubtitle}>Pronađi idealan termin za sebe</Text>

        {/* ===== DATE STRIP — Redesigned ===== */}
        <Text style={st.dateHeader}>Izaberi datum</Text>
        <View style={st.dateStripBg}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={st.dateStrip}
            testID="date-strip"
          >
            {workingDays.map((day) => {
              const isSelected = toDateStr(day) === dateStr;
              return (
                <TouchableOpacity
                  key={toDateStr(day)}
                  testID={`date-${toDateStr(day)}`}
                  style={st.dateItem}
                  onPress={() => setSelectedDate(day)}
                >
                  <Text style={[st.dateDayLabel, isSelected && st.dateDayLabelSelected]}>
                    {BosnianDaysShort[day.getDay()]}
                  </Text>
                  <View style={[st.dateCircle, isSelected && st.dateCircleSelected]}>
                    <Text style={[st.dateNum, isSelected && st.dateNumSelected]}>
                      {day.getDate()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* My booking today */}
        {myBookingToday && (
          <View style={st.myBookingCard} testID="my-booking-today">
            <Feather name="check-circle" size={18} color={Colors.primary} />
            <Text style={st.myBookingText}>
              Vaš termin za ovaj dan: {myBookingToday.vrijeme || myBookingToday.time}
            </Text>
          </View>
        )}

        {/* ===== TIME SLOTS — 3-column grid with bed icons ===== */}
        <Text style={st.slotsTitle}>Dostupni termini</Text>

        {daySlots.length > 0 ? (
          <View style={st.slotGrid}>
            {daySlots.map((slot: any, i: number) => (
              <SlotCard key={`s-${i}`} slot={slot} />
            ))}
          </View>
        ) : (
          <View style={st.emptyWrap}>
            <Feather name="calendar" size={40} color={Colors.muted} />
            <Text style={st.emptyText}>Nema dostupnih termina za ovaj datum</Text>
          </View>
        )}
      </ScrollView>

      {/* Confirm Modal */}
      <Modal visible={!!confirmSlot} transparent animationType="fade">
        <View style={st.overlay}>
          <View style={st.modalCard}>
            <Text style={st.modalTitle}>Potvrda termina</Text>
            <Text style={st.modalDate}>
              {confirmSlot && formatDateBosnian(confirmSlot.datum || confirmSlot.date || dateStr)}
            </Text>
            <Text style={st.modalTime}>{confirmSlot?.vrijeme || confirmSlot?.time}</Text>
            <Text style={st.modalQuestion}>Da li potvrđujete dolazak?</Text>
            <View style={st.modalBtns}>
              <TouchableOpacity testID="confirm-cancel-btn" style={st.modalBtnNo} onPress={() => setConfirmSlot(null)}>
                <Text style={st.modalBtnNoText}>Ne</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="confirm-yes-btn" style={[st.modalBtnYes, booking && { opacity: 0.6 }]}
                onPress={() => confirmSlot && handleBook(confirmSlot)} disabled={booking}>
                {booking ? <ActivityIndicator color={Colors.white} size="small" /> : (
                  <Text style={st.modalBtnYesText}>Da</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Share Modal */}
      <Modal visible={!!shareInfo} transparent animationType="fade">
        <View style={st.overlay}>
          <View style={st.modalCard}>
            <Feather name="check-circle" size={40} color={Colors.primary} style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Text style={st.modalTitle}>Termin rezervisan!</Text>
            <TouchableOpacity testID="share-btn" style={st.shareBtn} onPress={handleShare}>
              <Feather name="share-2" size={18} color={Colors.white} />
              <Text style={st.shareBtnText}>Podijeli termin s prijateljicom</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="share-skip-btn" onPress={() => setShareInfo(null)}>
              <Text style={st.skipText}>Preskoči</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  content: { paddingHorizontal: 16 },

  // Header
  pageTitle: { fontFamily: Fonts.heading, fontSize: 26, color: Colors.foreground, marginBottom: 4 },
  pageSubtitle: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.muted, marginBottom: 24 },

  // Date strip
  dateHeader: { fontFamily: Fonts.heading, fontSize: 18, color: Colors.foreground, marginBottom: 12 },
  dateStripBg: {
    backgroundColor: Colors.secondary,
    borderRadius: 20,
    paddingVertical: 12,
    marginBottom: 20,
  },
  dateStrip: { paddingHorizontal: 8, gap: 0 },
  dateItem: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dateDayLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 12,
    color: Colors.muted,
  },
  dateDayLabelSelected: { color: Colors.foreground, fontFamily: Fonts.bodyBold },
  dateCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateCircleSelected: {
    backgroundColor: Colors.foreground,
  },
  dateNum: {
    fontFamily: Fonts.bodyBold,
    fontSize: 20,
    color: Colors.foreground,
  },
  dateNumSelected: {
    color: Colors.background,
  },

  // My booking
  myBookingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...CardStyle,
    backgroundColor: Colors.secondary,
    borderColor: Colors.primary,
    marginBottom: 16,
  },
  myBookingText: { fontFamily: Fonts.bodyMedium, fontSize: Sizes.small, color: Colors.foreground, flex: 1 },

  // Slots
  slotsTitle: { fontFamily: Fonts.heading, fontSize: 18, color: Colors.foreground, marginBottom: 14 },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  slotCard: {
    width: '31%',
    backgroundColor: Colors.secondary,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 8,
  },
  slotCardFull: {
    opacity: 0.5,
  },
  slotTime: {
    fontFamily: Fonts.bodyBold,
    fontSize: 18,
    color: Colors.foreground,
  },
  slotTimeFull: { color: Colors.muted },
  bedRow: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotFullLabel: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Colors.muted,
    marginTop: -2,
  },

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.muted, textAlign: 'center' },

  // Toast
  toast: {
    position: 'absolute', top: 60, left: 16, right: 16,
    backgroundColor: Colors.primary, borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    zIndex: 9999, elevation: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  toastText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.small, color: Colors.white, flex: 1 },

  // Modals — unchanged
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: Colors.cardBg, borderRadius: 24, padding: 24, width: '100%', maxWidth: 360 },
  modalTitle: { fontFamily: Fonts.heading, fontSize: Sizes.h3, color: Colors.foreground, textAlign: 'center', marginBottom: 16 },
  modalDate: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.body, color: Colors.foreground, textAlign: 'center' },
  modalTime: { fontFamily: Fonts.bodyBold, fontSize: Sizes.h2, color: Colors.primary, textAlign: 'center', marginBottom: 16 },
  modalQuestion: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.muted, textAlign: 'center', marginBottom: 20 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalBtnNo: { flex: 1, height: 48, borderRadius: 9999, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  modalBtnNoText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.body, color: Colors.foreground },
  modalBtnYes: { flex: 1, height: 48, borderRadius: 9999, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  modalBtnYesText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.body, color: Colors.white },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 9999, height: 48, marginBottom: 12 },
  shareBtnText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.small, color: Colors.white },
  skipText: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.muted, textAlign: 'center', paddingVertical: 8 },
});
