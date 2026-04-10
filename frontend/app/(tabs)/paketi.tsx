import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  RefreshControl, ActivityIndicator, Modal, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Fonts, Sizes, CardStyle } from '../../src/theme';
import { packagesAPI } from '../../src/api';

const BADGES: Record<string, { label: string; color: string }> = {
  'Linea Gold': { label: 'Najpopularniji', color: Colors.primary },
  'Linea Premium': { label: 'Najisplativiji', color: '#A68B5B' },
};

export default function PaketiScreen() {
  const insets = useSafeAreaInsets();
  const [packages, setPackages] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmPkg, setConfirmPkg] = useState<any>(null);
  const [requesting, setRequesting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [pkgs, reqs] = await Promise.allSettled([
        packagesAPI.getAll(),
        packagesAPI.myRequests(),
      ]);
      if (pkgs.status === 'fulfilled') setPackages(Array.isArray(pkgs.value) ? pkgs.value : []);
      if (reqs.status === 'fulfilled') setMyRequests(Array.isArray(reqs.value) ? reqs.value : []);
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

  const pendingReq = myRequests.find((r: any) => r.status === 'pending' || r.status === 'na_cekanju');
  const hasPending = !!pendingReq;

  const handleRequest = async () => {
    if (!confirmPkg) return;
    setRequesting(true);
    try {
      await packagesAPI.request(confirmPkg.id || confirmPkg._id || confirmPkg.package_id);
      Alert.alert('Uspješno', 'Zahtjev za paket je poslan');
      setConfirmPkg(null);
      await loadData();
    } catch (e: any) {
      Alert.alert('Greška', e.message || 'Greška pri slanju zahtjeva');
    } finally {
      setRequesting(false);
    }
  };

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
        <Text style={styles.pageTitle}>Paketi</Text>
        <Text style={styles.pageSubtitle}>Odaberite paket koji vam odgovara</Text>

        {hasPending && (
          <View style={styles.pendingBanner} testID="pending-request-banner">
            <Feather name="clock" size={18} color={Colors.primary} />
            <View style={styles.pendingTextWrap}>
              <Text style={styles.pendingTitle}>Vaš paket čeka aktivaciju nakon uplate</Text>
              <Text style={styles.pendingName}>{pendingReq.package_name || pendingReq.naziv || ''}</Text>
            </View>
          </View>
        )}

        {packages.map((pkg: any) => {
          const name = pkg.naziv || pkg.name || '';
          const badge = BADGES[name];
          const price = pkg.cijena || pkg.price;
          const sessions = pkg.termini || pkg.broj_termina || pkg.sessions;
          const pkgId = pkg.id || pkg._id || pkg.package_id;

          return (
            <View
              key={pkgId}
              style={[styles.card, (pkg.popular || pkg.best_value || badge) && styles.cardBadge]}
              testID={`package-card-${name.replace(/\s/g, '-').toLowerCase()}`}
            >
              {(badge || pkg.popular || pkg.best_value) && (
                <View style={[styles.badgeTag, { backgroundColor: badge?.color || (pkg.popular ? Colors.primary : '#A68B5B') }]}>
                  <Text style={styles.badgeText}>
                    {badge?.label || (pkg.popular ? 'Najpopularniji' : 'Najisplativiji')}
                  </Text>
                </View>
              )}
              <View style={styles.cardContent}>
                <View style={styles.cardLeft}>
                  <Text style={styles.pkgName}>{name}</Text>
                  <Text style={styles.pkgDesc}>Mala grupa do 3 osobe</Text>
                  <View style={styles.sessionsRow}>
                    <Feather name="check" size={14} color={Colors.primary} />
                    <Text style={styles.sessionsText}>{sessions} termina / mjesec</Text>
                  </View>
                </View>
                <View style={styles.cardRight}>
                  <Text style={styles.pkgPrice}>{price}</Text>
                  <Text style={styles.pkgCurrency}>KM</Text>
                </View>
              </View>
              <TouchableOpacity
                testID={`select-package-${pkgId}`}
                style={[
                  badge ? styles.primaryBtn : styles.secondarySelectBtn,
                  hasPending && styles.btnDisabled,
                ]}
                onPress={() => !hasPending && setConfirmPkg(pkg)}
                disabled={hasPending}
              >
                <Text style={[
                  badge ? styles.primaryBtnText : styles.secondaryBtnText,
                  hasPending && styles.disabledText,
                ]}>
                  {hasPending ? 'Na čekanju' : 'Odaberi'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      {/* Confirm Modal */}
      <Modal visible={!!confirmPkg} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Potvrda paketa</Text>
            <View style={styles.modalInfo}>
              <Text style={styles.modalPkgName}>{confirmPkg?.naziv || confirmPkg?.name}</Text>
              <Text style={styles.modalPkgPrice}>{confirmPkg?.cijena || confirmPkg?.price} KM</Text>
              <Text style={styles.modalPkgSessions}>
                {confirmPkg?.broj_termina || confirmPkg?.sessions} termina / mjesec
              </Text>
            </View>
            <Text style={styles.modalNote}>
              Nakon potvrde, vaš paket će čekati aktivaciju od strane studija nakon uplate.
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                testID="pkg-confirm-cancel"
                style={styles.modalBtnNo}
                onPress={() => setConfirmPkg(null)}
              >
                <Text style={styles.modalBtnNoText}>Odustani</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="pkg-confirm-yes"
                style={[styles.modalBtnYes, requesting && { opacity: 0.6 }]}
                onPress={handleRequest}
                disabled={requesting}
              >
                {requesting ? <ActivityIndicator color={Colors.white} size="small" /> : (
                  <Text style={styles.modalBtnYesText}>Potvrdi</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  content: { paddingHorizontal: 16 },
  pageTitle: { fontFamily: Fonts.heading, fontSize: Sizes.h2, color: Colors.foreground, marginBottom: 4 },
  pageSubtitle: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.muted, marginBottom: 20 },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...CardStyle,
    backgroundColor: Colors.secondary,
    borderColor: Colors.primary,
    marginBottom: 16,
  },
  pendingTextWrap: { flex: 1 },
  pendingTitle: { fontFamily: Fonts.bodyMedium, fontSize: Sizes.small, color: Colors.foreground },
  pendingName: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.small, color: Colors.primary, marginTop: 2 },
  card: {
    ...CardStyle,
    marginBottom: 16,
    position: 'relative',
    overflow: 'visible',
  },
  cardBadge: { borderWidth: 2, borderColor: Colors.primary },
  badgeTag: {
    position: 'absolute',
    top: -12,
    right: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeText: { fontFamily: Fonts.bodySemiBold, fontSize: 11, color: Colors.white },
  cardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  cardLeft: { flex: 1 },
  pkgName: { fontFamily: Fonts.heading, fontSize: 18, color: Colors.foreground, marginBottom: 4 },
  pkgDesc: { fontFamily: Fonts.body, fontSize: Sizes.tiny, color: Colors.muted, marginBottom: 8 },
  sessionsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sessionsText: { fontFamily: Fonts.bodyMedium, fontSize: Sizes.small, color: Colors.foreground },
  cardRight: { alignItems: 'flex-end' },
  pkgPrice: { fontFamily: Fonts.heading, fontSize: 28, color: Colors.foreground },
  pkgCurrency: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.muted },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 9999,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.small, color: Colors.white },
  secondarySelectBtn: {
    backgroundColor: Colors.secondary,
    borderRadius: 9999,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.small, color: Colors.foreground },
  btnDisabled: { opacity: 0.5 },
  disabledText: { color: Colors.muted },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: { backgroundColor: Colors.cardBg, borderRadius: 24, padding: 24, width: '100%', maxWidth: 360 },
  modalTitle: { fontFamily: Fonts.heading, fontSize: Sizes.h3, color: Colors.foreground, textAlign: 'center', marginBottom: 16 },
  modalInfo: { alignItems: 'center', marginBottom: 16 },
  modalPkgName: { fontFamily: Fonts.heading, fontSize: 18, color: Colors.foreground, marginBottom: 4 },
  modalPkgPrice: { fontFamily: Fonts.bodyBold, fontSize: Sizes.h2, color: Colors.primary, marginBottom: 4 },
  modalPkgSessions: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.muted },
  modalNote: {
    fontFamily: Fonts.body,
    fontSize: Sizes.tiny,
    color: Colors.muted,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalBtnNo: {
    flex: 1,
    height: 48,
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnNoText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.body, color: Colors.foreground },
  modalBtnYes: {
    flex: 1,
    height: 48,
    borderRadius: 9999,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnYesText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.body, color: Colors.white },
});
