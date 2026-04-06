import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Sizes, CardStyle, formatDateBosnian } from '../../src/theme';
import { invitesAPI } from '../../src/api';

const LOGO_URL = 'https://customer-assets.emergentagent.com/job_pilates-hub-12/artifacts/ny62z2sx_linea.png';

export default function PozivnicaScreen() {
  const { inviteId } = useLocalSearchParams<{ inviteId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!inviteId) return;
    (async () => {
      try {
        const data = await invitesAPI.get(inviteId);
        setInvite(data);
      } catch (e: any) {
        setError(e.message || 'Pozivnica nije pronađena');
      } finally {
        setLoading(false);
      }
    })();
  }, [inviteId]);

  const handleAccept = async () => {
    if (!inviteId) return;
    setAccepting(true);
    try {
      await invitesAPI.accept(inviteId);
      Alert.alert('Uspješno', 'Poziv je prihvaćen!', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (e: any) {
      Alert.alert('Greška', e.message || 'Greška pri prihvatanju poziva');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Feather name="alert-circle" size={40} color={Colors.danger} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backLink} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.backLinkText}>Nazad na početnu</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
      <View style={styles.logoWrap}>
        {/* We'd show the logo image here but using text fallback */}
        <Text style={styles.logoText}>Linea Pilates</Text>
      </View>

      <Text style={styles.title}>Poziv na trening</Text>
      <Text style={styles.subtitle}>
        {invite?.inviter_name || invite?.ime || 'Prijatelj/ica'} te poziva na zajednički Pilates Reformer trening
      </Text>

      <View style={styles.card}>
        <View style={styles.detailRow}>
          <Feather name="calendar" size={18} color={Colors.primary} />
          <Text style={styles.detailText}>
            {invite?.datum ? formatDateBosnian(invite.datum) : invite?.date || ''}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Feather name="clock" size={18} color={Colors.primary} />
          <Text style={styles.detailText}>{invite?.vrijeme || invite?.time || ''}</Text>
        </View>
        <View style={styles.detailRow}>
          <Feather name="user" size={18} color={Colors.primary} />
          <Text style={styles.detailText}>{invite?.instruktor || 'Marija Trisic'}</Text>
        </View>
      </View>

      <TouchableOpacity
        testID="accept-invite-btn"
        style={[styles.acceptBtn, accepting && { opacity: 0.6 }]}
        onPress={handleAccept}
        disabled={accepting}
      >
        {accepting ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.acceptBtnText}>Prihvati poziv</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.note}>
        Potrebna je aktivna članarina za prihvatanje poziva
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 24,
    gap: 12,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  logoWrap: { marginBottom: 32 },
  logoText: { fontFamily: Fonts.heading, fontSize: 28, color: Colors.primary },
  title: {
    fontFamily: Fonts.heading,
    fontSize: Sizes.h2,
    color: Colors.foreground,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: Sizes.body,
    color: Colors.muted,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  card: { ...CardStyle, width: '100%', marginBottom: 32, gap: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailText: { fontFamily: Fonts.bodyMedium, fontSize: Sizes.body, color: Colors.foreground },
  acceptBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 9999,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  acceptBtnText: { fontFamily: Fonts.bodySemiBold, fontSize: 18, color: Colors.white },
  note: {
    fontFamily: Fonts.body,
    fontSize: Sizes.tiny,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorText: {
    fontFamily: Fonts.body,
    fontSize: Sizes.body,
    color: Colors.danger,
    textAlign: 'center',
  },
  backLink: { paddingVertical: 8 },
  backLinkText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.small, color: Colors.primary },
});
