import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  RefreshControl, ActivityIndicator, Modal, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors, Fonts, Sizes, CardStyle } from '../../src/theme';
import { packagesAPI, homeAPI } from '../../src/api';

const BADGE_COLORS: Record<string, string> = {
  'Linea Gold': Colors.primary,
  'Linea Premium': '#A68B5B',
};

export default function PaketiScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [packages, setPackages] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [activeMemberships, setActiveMemberships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmPkg, setConfirmPkg] = useState<any>(null);
  const [requesting, setRequesting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [pkgs, reqs, mems] = await Promise.allSettled([
        packagesAPI.getAll(),
        packagesAPI.myRequests(),
        homeAPI.activeMemberships(),
      ]);
      if (pkgs.status === 'fulfilled') setPackages(Array.isArray(pkgs.value) ? pkgs.value : []);
      if (reqs.status === 'fulfilled') setMyRequests(Array.isArray(reqs.value) ? reqs.value : []);
      if (mems.status === 'fulfilled') setActiveMemberships(Array.isArray(mems.value) ? mems.value : []);
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

  const pendingReq = myRequests.find((r: any) => r.status === 'pending' || r.status === 'na_cekanju');
  const hasPending = !!pendingReq;
  const hasActiveMembership = activeMemberships.some((m: any) => m.tip === 'aktivna' || m.status === 'aktivna' || m.active === true);
  const isBlocked = hasActiveMembership || hasPending;

  const handleRequest = async () => {
    if (!confirmPkg) return;
    setRequesting(true);
    try {
      await packagesAPI.request(confirmPkg.id || confirmPkg._id || confirmPkg.package_id);
      Alert.alert(t('common.success'), t('packages.requestSent'));
      setConfirmPkg(null);
      await loadData();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message || t('packages.requestError'));
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
        <Text style={styles.pageTitle}>{t('packages.pageTitle')}</Text>
        <Text style={styles.pageSubtitle}>{t('packages.pageSubtitle')}</Text>

        {hasActiveMembership && (
          <View style={styles.activeBanner} testID="active-membership-banner">
            <Feather name="info" size={18} color={Colors.primary} />
            <Text style={styles.activeBannerText}>
              {t('packages.activeBannerText')}
            </Text>
          </View>
        )}

        {hasPending && (
          <View style={styles.pendingBanner} testID="pending-request-banner">
            <Feather name="clock" size={18} color={Colors.primary} />
            <View style={styles.pendingTextWrap}>
              <Text style={styles.pendingTitle}>{t('home.packagePending')}</Text>
              <Text style={styles.pendingName}>{pendingReq.package_name || pendingReq.naziv || ''}</Text>
            </View>
          </View>
        )}

        {packages.map((pkg: any) => {
          const name = pkg.naziv || pkg.name || '';
          const badgeColor = BADGE_COLORS[name];
          const badgeLabel = name === 'Linea Gold' ? t('packages.mostPopular')
            : name === 'Linea Premium' ? t('packages.bestValue') : undefined;
          const badge = badgeColor ? { color: badgeColor, label: badgeLabel } : undefined;
          const price = pkg.cijena || pkg.price;
          const sessions = pkg.termini || pkg.broj_termina || pkg.sessions;
          const pkgId = pkg.id || pkg._id || pkg.package_id;
          const unlimited = !!pkg.neograniceni;

          return (
            <View
              key={pkgId}
              style={[styles.card, (pkg.popular || pkg.best_value || badge) && styles.cardBadge]}
              testID={`package-card-${name.replace(/\s/g, '-').toLowerCase()}`}
            >
              {(badge || pkg.popular || pkg.best_value) && (
                <View style={[styles.badgeTag, { backgroundColor: badge?.color || (pkg.popular ? Colors.primary : '#A68B5B') }]}>
                  <Text style={styles.badgeText}>
                    {badge?.label || (pkg.popular ? t('packages.mostPopular') : t('packages.bestValue'))}
                  </Text>
                </View>
              )}
              <View style={styles.cardContent}>
                <View style={styles.cardLeft}>
                  <Text style={styles.pkgName}>{name}</Text>
                  <Text style={styles.pkgDesc}>{t('packages.smallGroup')}</Text>
                  <View style={styles.sessionsRow}>
                    <Feather name={unlimited ? 'repeat' : 'check'} size={14} color={Colors.primary} />
                    <Text style={styles.sessionsText}>
                      {unlimited
                        ? t('packages.unlimitedSessions')
                        : t('packages.sessionsPerMonth', { count: sessions })}
                    </Text>
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
                  isBlocked && styles.btnDisabled,
                ]}
                onPress={() => {
                  if (isBlocked) {
                    if (hasActiveMembership) {
                      Alert.alert(t('packages.activePackageTitle'), t('packages.activePackageMsg'));
                    }
                    return;
                  }
                  setConfirmPkg(pkg);
                }}
                disabled={isBlocked}
              >
                <Text style={[
                  badge ? styles.primaryBtnText : styles.secondaryBtnText,
                  isBlocked && styles.disabledText,
                ]}>
                  {hasActiveMembership ? t('packages.activePackage') : hasPending ? t('packages.pending') : t('packages.select')}
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
            <Text style={styles.modalTitle}>{t('packages.confirmTitle')}</Text>
            <View style={styles.modalInfo}>
              <Text style={styles.modalPkgName}>{confirmPkg?.naziv || confirmPkg?.name}</Text>
              <Text style={styles.modalPkgPrice}>{confirmPkg?.cijena || confirmPkg?.price} KM</Text>
              <Text style={styles.modalPkgSessions}>
                {confirmPkg?.neograniceni
                  ? t('packages.unlimitedSessions')
                  : t('packages.sessionsPerMonth', { count: confirmPkg?.broj_termina || confirmPkg?.sessions })}
              </Text>
              {confirmPkg?.neograniceni && (
                <Text style={styles.modalPkgUnlimitedNote}>
                  {t('packages.unlimitedNote', { days: confirmPkg?.trajanje_dana || 35 })}
                </Text>
              )}
            </View>
            <Text style={styles.modalNote}>
              {t('packages.confirmNote')}
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                testID="pkg-confirm-cancel"
                style={styles.modalBtnNo}
                onPress={() => setConfirmPkg(null)}
              >
                <Text style={styles.modalBtnNoText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="pkg-confirm-yes"
                style={[styles.modalBtnYes, requesting && { opacity: 0.6 }]}
                onPress={handleRequest}
                disabled={requesting}
              >
                {requesting ? <ActivityIndicator color={Colors.white} size="small" /> : (
                  <Text style={styles.modalBtnYesText}>{t('common.confirm')}</Text>
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
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...CardStyle,
    backgroundColor: '#FDF6EC',
    borderColor: Colors.primary,
    marginBottom: 16,
  },
  activeBannerText: {
    flex: 1,
    fontFamily: Fonts.bodyMedium,
    fontSize: Sizes.small,
    color: Colors.foreground,
    lineHeight: 20,
  },
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
  modalPkgUnlimitedNote: {
    fontFamily: Fonts.body,
    fontSize: Sizes.tiny,
    color: Colors.primary,
    textAlign: 'center',
    marginTop: 4,
  },
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
