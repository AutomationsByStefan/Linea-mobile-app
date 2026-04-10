import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  RefreshControl, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Line, Circle, Text as SvgText, Polyline, Rect } from 'react-native-svg';
import { Colors, Fonts, Sizes, CardStyle, formatDateShort } from '../src/theme';
import { weightAPI } from '../src/api';

export default function TezinaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [adding, setAdding] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await weightAPI.getAll();
      setEntries(Array.isArray(data) ? data : []);
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

  const handleAdd = async () => {
    const w = parseFloat(newWeight);
    if (isNaN(w) || w <= 0) { Alert.alert('Greška', 'Unesite validnu težinu'); return; }
    setAdding(true);
    try {
      await weightAPI.add(w);
      setNewWeight('');
      await loadData();
    } catch (e: any) {
      Alert.alert('Greška', e.message || 'Greška pri dodavanju');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Brisanje', 'Da li ste sigurni?', [
      { text: 'Ne', style: 'cancel' },
      {
        text: 'Da', style: 'destructive',
        onPress: async () => {
          try {
            await weightAPI.remove(id);
            await loadData();
          } catch (e) { console.error(e); }
        },
      },
    ]);
  };

  // Chart
  const chartEntries = entries.slice(-10);
  const weights = chartEntries.map((e: any) => e.weight || e.tezina || 0);
  const minW = Math.min(...weights) - 1;
  const maxW = Math.max(...weights) + 1;
  const chartW = 340;
  const chartH = 180;
  const padX = 40;
  const padY = 20;

  const getX = (i: number) => padX + (i / Math.max(chartEntries.length - 1, 1)) * (chartW - padX * 2);
  const getY = (w: number) => padY + ((maxW - w) / (maxW - minW || 1)) * (chartH - padY * 2);

  const points = chartEntries.map((e: any, i: number) => `${getX(i)},${getY(e.weight || e.tezina || 0)}`).join(' ');

  // Trend
  let trendText = '';
  let trendColor = Colors.muted;
  let trendIcon: 'trending-down' | 'trending-up' | 'minus' = 'minus';
  if (weights.length >= 2) {
    const diff = weights[weights.length - 1] - weights[0];
    if (diff < -0.1) {
      trendText = `Smanjenje od ${Math.abs(diff).toFixed(1)} kg`;
      trendColor = Colors.success;
      trendIcon = 'trending-down';
    } else if (diff > 0.1) {
      trendText = `Povećanje od ${diff.toFixed(1)} kg`;
      trendColor = Colors.warning;
      trendIcon = 'trending-up';
    } else {
      trendText = 'Bez promjene';
    }
  }

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity testID="tezina-back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Praćenje težine</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <Text style={styles.infoText}>
          Ova funkcija je opcionalna. Pratite svoj napredak ako želite.
        </Text>

        {/* Add Entry */}
        <View style={styles.addRow}>
          <View style={styles.addInputWrap}>
            <TextInput
              testID="weight-input"
              style={styles.addInput}
              value={newWeight}
              onChangeText={setNewWeight}
              placeholder="Težina"
              placeholderTextColor={Colors.muted}
              keyboardType="decimal-pad"
            />
            <Text style={styles.kgLabel}>kg</Text>
          </View>
          <TouchableOpacity
            testID="add-weight-btn"
            style={[styles.addBtn, adding && { opacity: 0.6 }]}
            onPress={handleAdd}
            disabled={adding}
          >
            {adding ? <ActivityIndicator color={Colors.white} size="small" /> : (
              <Feather name="plus" size={22} color={Colors.white} />
            )}
          </TouchableOpacity>
        </View>

        {/* Chart */}
        {chartEntries.length > 1 && (
          <View style={styles.card} testID="weight-chart">
            <Svg width={chartW} height={chartH}>
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
                const y = padY + p * (chartH - padY * 2);
                const val = maxW - p * (maxW - minW);
                return (
                  <React.Fragment key={i}>
                    <Line x1={padX} y1={y} x2={chartW - padX} y2={y} stroke={Colors.border} strokeWidth={1} />
                    <SvgText x={4} y={y + 4} fontSize={9} fill={Colors.muted}>{val.toFixed(0)}</SvgText>
                  </React.Fragment>
                );
              })}
              <Polyline points={points} fill="none" stroke={Colors.primary} strokeWidth={2.5} />
              {chartEntries.map((e: any, i: number) => (
                <Circle
                  key={i}
                  cx={getX(i)}
                  cy={getY(e.weight || e.tezina || 0)}
                  r={4}
                  fill={Colors.primary}
                  stroke={Colors.white}
                  strokeWidth={2}
                />
              ))}
            </Svg>

            {trendText ? (
              <View style={[styles.trendRow, { borderTopColor: Colors.border }]}>
                <Feather name={trendIcon} size={16} color={trendColor} />
                <Text style={[styles.trendText, { color: trendColor }]}>{trendText}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* History */}
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
        ) : entries.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Feather name="activity" size={40} color={Colors.muted} />
            <Text style={styles.emptyText}>Nema unosa težine</Text>
          </View>
        ) : (
          entries.map((e: any, i: number) => {
            const id = e.id || e._id || String(i);
            const w = e.weight || e.tezina;
            const date = e.date || e.datum || e.created_at;
            let arrow: 'trending-down' | 'trending-up' | 'minus' = 'minus';
            if (i < entries.length - 1) {
              const prev = entries[i + 1]?.weight || entries[i + 1]?.tezina || 0;
              if (w < prev) arrow = 'trending-down';
              else if (w > prev) arrow = 'trending-up';
            }

            return (
              <View key={id} style={styles.entryRow} testID={`weight-entry-${id}`}>
                <View style={styles.entryInfo}>
                  <Text style={styles.entryDate}>{date ? formatDateShort(date) : ''}</Text>
                  <View style={styles.entryWeightRow}>
                    <Text style={styles.entryWeight}>{w}</Text>
                    <Text style={styles.entryKg}>kg</Text>
                  </View>
                </View>
                <Feather name={arrow} size={18} color={
                  arrow === 'trending-down' ? Colors.success :
                  arrow === 'trending-up' ? Colors.warning : Colors.muted
                } />
                <TouchableOpacity testID={`delete-weight-${id}`} onPress={() => handleDelete(id)} style={styles.deleteBtn}>
                  <Feather name="trash-2" size={16} color={Colors.danger} />
                </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.heading, fontSize: Sizes.h3, color: Colors.foreground },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  infoText: {
    fontFamily: Fonts.body,
    fontSize: Sizes.small,
    color: Colors.muted,
    textAlign: 'center',
    marginBottom: 20,
  },
  addRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  addInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  addInput: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: Sizes.body,
    color: Colors.foreground,
    paddingVertical: 14,
  },
  kgLabel: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.small, color: Colors.muted },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: { ...CardStyle, marginBottom: 16, alignItems: 'center' },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    width: '100%',
    justifyContent: 'center',
  },
  trendText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.small },
  entryRow: {
    ...CardStyle,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  entryInfo: { flex: 1 },
  entryDate: { fontFamily: Fonts.body, fontSize: Sizes.tiny, color: Colors.muted, marginBottom: 2 },
  entryWeightRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  entryWeight: { fontFamily: Fonts.heading, fontSize: 22, color: Colors.foreground },
  entryKg: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.muted },
  deleteBtn: { padding: 8 },
  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.muted },
});
