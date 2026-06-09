import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  RefreshControl, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Sizes, CardStyle, formatDateWithDay, toDateTime } from '../src/theme';
import { trainingAPI, api } from '../src/api';

export default function TreninziScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [past, setPast] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [commentingId, setCommentingId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [u, p] = await Promise.allSettled([
        trainingAPI.upcoming(),
        trainingAPI.past(),
      ]);
      if (u.status === 'fulfilled') {
        const list = Array.isArray(u.value) ? u.value : [];
        // Filter out cancelled trainings
        setUpcoming(list.filter((t: any) => (t.tip || t.status || '').toLowerCase() !== 'otkazani' && (t.tip || t.status || '').toLowerCase() !== 'cancelled'));
      }
      if (p.status === 'fulfilled') setPast(Array.isArray(p.value) ? p.value : []);
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

  const handleSaveComment = async (trainingId: string) => {
    if (!commentText.trim()) return;
    setSaving(true);
    try {
      await trainingAPI.comment(trainingId, commentText.trim());
      setCommentingId(null);
      setCommentText('');
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (training: any) => {
    const tid = training.id || training._id || training.training_id;
    if (!tid) {
      Alert.alert('Greška', 'Trening nije moguće identifikovati.');
      return;
    }
    const datum = training.datum || training.date;
    const vrijeme = training.vrijeme || training.time;

    // Decide based on how far away the training is. More than 12h → direct
    // cancel; 12h or less → send a cancellation request for admin approval.
    // An unparseable date is treated as <12h (the safer, admin-approval path).
    const trainingDate = toDateTime(datum, vrijeme);
    const hoursUntil = trainingDate
      ? (trainingDate.getTime() - Date.now()) / (1000 * 60 * 60)
      : 0;

    if (hoursUntil > 12) {
      // Direct cancellation
      Alert.alert(
        'Otkaži trening',
        'Da li ste sigurni da želite otkazati ovaj trening?',
        [
          { text: 'Ne', style: 'cancel' },
          { text: 'Da, otkaži', style: 'destructive', onPress: async () => {
            setCancelling(tid);
            try {
              await api.post(`/api/trainings/${tid}/cancel`);
              // Remove from local state immediately
              setUpcoming(prev => prev.filter((t: any) => (t.id || t._id || t.training_id) !== tid));
              Alert.alert('Uspješno', 'Trening je otkazan');
            } catch (e: any) {
              Alert.alert('Greška', e?.message || 'Nije moguće otkazati trening');
            } finally {
              setCancelling(null);
            }
          }},
        ]
      );
    } else {
      // Within 12h — send a cancellation request for admin approval
      Alert.alert(
        'Zahtjev za otkazivanje',
        'Trening je zakazan za manje od 12 sati. Želite li poslati zahtjev za otkazivanje administratoru?',
        [
          { text: 'Odustani', style: 'cancel' },
          { text: 'Pošalji zahtjev', onPress: async () => {
            setCancelling(tid);
            try {
              await api.post(`/api/trainings/${tid}/request-cancel`);
              Alert.alert('Zahtjev poslan', 'Zahtjev za otkazivanje je poslan. Administrator će odobriti ili odbiti vaš zahtjev.');
            } catch (e: any) {
              Alert.alert('Greška', e?.message || 'Greška pri slanju zahtjeva');
            } finally {
              setCancelling(null);
            }
          }},
        ]
      );
    }
  };

  const data = tab === 'upcoming' ? upcoming : past;

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity testID="treninzi-back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tvoji treninzi</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          testID="tab-upcoming"
          style={[styles.tabBtn, tab === 'upcoming' && styles.tabBtnActive]}
          onPress={() => setTab('upcoming')}
        >
          <Text style={[styles.tabText, tab === 'upcoming' && styles.tabTextActive]}>Predstojeći</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="tab-past"
          style={[styles.tabBtn, tab === 'past' && styles.tabBtnActive]}
          onPress={() => setTab('past')}
        >
          <Text style={[styles.tabText, tab === 'past' && styles.tabTextActive]}>Iskorišteni</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
        ) : data.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Feather name="calendar" size={40} color={Colors.muted} />
            <Text style={styles.emptyText}>
              {tab === 'upcoming' ? 'Nemate predstojeće treninge' : 'Nemate prošle treninge'}
            </Text>
          </View>
        ) : (
          data.map((t: any, i: number) => {
            const tid = t.id || t._id || t.training_id || String(i);
            const datum = t.datum || t.date;
            const vrijeme = t.vrijeme || t.time;
            const komentar = t.komentar || t.comment;
            const isCommenting = commentingId === tid;
            const isPast = tab === 'past';
            const isUpcoming = tab === 'upcoming';
            // Status shown for past/completed trainings (Bug 10)
            const rawStatus = (t.tip || t.status || '').toString().toLowerCase();
            const statusLabel = t.historical
              ? 'Istorijski'
              : (rawStatus.includes('otkazan') || rawStatus === 'cancelled')
                ? 'Otkazan'
                : 'Iskorišten';

            return (
              <View key={tid} style={styles.card} testID={`training-${tid}`}>
                <View style={styles.trainingRow}>
                  <View style={[styles.trainingIcon, isPast && styles.trainingIconPast]}>
                    <Feather name={isPast ? 'check' : 'calendar'} size={22} color={isPast ? Colors.muted : Colors.white} />
                  </View>
                  <View style={styles.trainingInfo}>
                    <Text style={styles.trainingDate}>{datum ? formatDateWithDay(datum) : ''}</Text>
                    <View style={styles.timeRow}>
                      <Feather name="clock" size={14} color={Colors.muted} />
                      <Text style={styles.trainingTime}>{vrijeme}</Text>
                    </View>
                    <Text style={styles.instructor}>Instruktor: Marija Trisic</Text>
                  </View>
                  {isPast && (
                    <View style={styles.usedBadge}>
                      <Text style={styles.usedBadgeText}>{statusLabel}</Text>
                    </View>
                  )}
                </View>

                {/* Cancel button for upcoming */}
                {isUpcoming && (
                  <TouchableOpacity
                    testID={`cancel-training-${tid}`}
                    style={styles.cancelTrainingBtn}
                    onPress={() => handleCancel(t)}
                    disabled={cancelling === tid}
                  >
                    {cancelling === tid ? (
                      <ActivityIndicator color={Colors.danger} size="small" />
                    ) : (
                      <>
                        <Feather name="x-circle" size={14} color={Colors.danger} />
                        <Text style={styles.cancelTrainingText}>Otkaži trening</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {isPast && komentar && !isCommenting && (
                  <View style={styles.commentBox}>
                    <Text style={styles.commentLabel}>Tvoj komentar:</Text>
                    <Text style={styles.commentContent}>{komentar}</Text>
                  </View>
                )}

                {isPast && !isCommenting && (
                  <TouchableOpacity
                    testID={`comment-btn-${tid}`}
                    style={styles.commentBtn}
                    onPress={() => { setCommentingId(tid); setCommentText(komentar || ''); }}
                  >
                    <Feather name="message-square" size={14} color={Colors.primary} />
                    <Text style={styles.commentBtnText}>
                      {komentar ? 'Izmijeni komentar' : 'Dodaj komentar'}
                    </Text>
                  </TouchableOpacity>
                )}

                {isCommenting && (
                  <View style={styles.commentForm}>
                    <TextInput
                      testID={`comment-input-${tid}`}
                      style={styles.commentInput}
                      value={commentText}
                      onChangeText={setCommentText}
                      placeholder="Kako si se osjećao/la na treningu?"
                      placeholderTextColor={Colors.muted}
                      multiline
                      numberOfLines={3}
                    />
                    <View style={styles.commentActions}>
                      <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={() => { setCommentingId(null); setCommentText(''); }}
                      >
                        <Text style={styles.cancelBtnText}>Otkaži</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        testID={`save-comment-${tid}`}
                        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                        onPress={() => handleSaveComment(tid)}
                        disabled={saving}
                      >
                        <Feather name="send" size={14} color={Colors.white} />
                        <Text style={styles.saveBtnText}>Sačuvaj</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.heading, fontSize: Sizes.h3, color: Colors.foreground },
  tabs: {
    flexDirection: 'row', marginHorizontal: 16, backgroundColor: Colors.secondary,
    borderRadius: 12, padding: 4, marginBottom: 16,
  },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.small, color: Colors.foreground },
  tabTextActive: { color: Colors.white },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { ...CardStyle, marginBottom: 12 },
  trainingRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  trainingIcon: {
    width: 48, height: 48, borderRadius: 16, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  trainingIconPast: { backgroundColor: Colors.secondary },
  trainingInfo: { flex: 1 },
  trainingDate: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.body, color: Colors.foreground, marginBottom: 4 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  trainingTime: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.muted },
  instructor: { fontFamily: Fonts.body, fontSize: Sizes.tiny, color: Colors.muted },
  usedBadge: { backgroundColor: 'rgba(166,139,91,0.1)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  usedBadgeText: { fontFamily: Fonts.bodySemiBold, fontSize: 10, color: Colors.primary },
  cancelTrainingBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 12, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.danger, backgroundColor: Colors.danger + '08',
  },
  cancelTrainingText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.small, color: Colors.danger },
  commentBox: {
    marginTop: 12, backgroundColor: Colors.background, borderRadius: 12, padding: 12,
  },
  commentLabel: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.tiny, color: Colors.muted, marginBottom: 4 },
  commentContent: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.foreground },
  commentBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, alignSelf: 'flex-start' },
  commentBtnText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.tiny, color: Colors.primary },
  commentForm: { marginTop: 12 },
  commentInput: {
    backgroundColor: Colors.background, borderRadius: 12, padding: 12,
    fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.foreground,
    minHeight: 80, textAlignVertical: 'top',
  },
  commentActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  cancelBtnText: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.muted },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary,
    borderRadius: 9999, paddingVertical: 8, paddingHorizontal: 16,
  },
  saveBtnText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.small, color: Colors.white },
  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.muted, textAlign: 'center' },
});
