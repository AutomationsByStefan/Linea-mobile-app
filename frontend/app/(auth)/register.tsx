import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Sizes } from '../../src/theme';
import { useAuth } from '../../src/context/AuthContext';

const LOGO_URL = 'https://customer-assets.emergentagent.com/job_pilates-hub-12/artifacts/ny62z2sx_linea.png';

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ phone?: string }>();
  const { register } = useAuth();

  const [ime, setIme] = useState('');
  const [prezime, setPrezime] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const phoneNum = params.phone || '';

  const handleRegister = async () => {
    if (!ime.trim()) { setError('Unesite ime'); return; }
    if (!prezime.trim()) { setError('Unesite prezime'); return; }
    if (pin.length !== 4) { setError('PIN mora imati 4 cifre'); return; }
    if (pin !== confirmPin) { setError('PIN-ovi se ne podudaraju'); return; }

    setLoading(true);
    setError('');

    try {
      await register({
        phone: phoneNum,
        ime: ime.trim(),
        prezime: prezime.trim(),
        email: email.trim() || undefined,
        pin,
      });
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message || 'Greška pri registraciji');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={{ uri: LOGO_URL }} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Kreirajte nalog</Text>
        {phoneNum ? <Text style={styles.phoneInfo}>{phoneNum}</Text> : null}

        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={styles.label}>Ime</Text>
            <TextInput
              testID="register-ime-input"
              style={styles.input}
              value={ime}
              onChangeText={setIme}
              placeholder="Ime"
              placeholderTextColor={Colors.muted}
            />
          </View>
          <View style={styles.halfField}>
            <Text style={styles.label}>Prezime</Text>
            <TextInput
              testID="register-prezime-input"
              style={styles.input}
              value={prezime}
              onChangeText={setPrezime}
              placeholder="Prezime"
              placeholderTextColor={Colors.muted}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email (opcionalno)</Text>
          <View style={styles.inputRow}>
            <Feather name="mail" size={18} color={Colors.muted} style={styles.inputIcon} />
            <TextInput
              testID="register-email-input"
              style={styles.inputFlex}
              value={email}
              onChangeText={setEmail}
              placeholder="email@primjer.com"
              placeholderTextColor={Colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={styles.label}>PIN</Text>
            <TextInput
              testID="register-pin-input"
              style={styles.input}
              value={pin}
              onChangeText={(t) => setPin(t.replace(/[^0-9]/g, '').slice(0, 4))}
              placeholder="4 cifre"
              placeholderTextColor={Colors.muted}
              keyboardType="numeric"
              secureTextEntry
              maxLength={4}
            />
          </View>
          <View style={styles.halfField}>
            <Text style={styles.label}>Potvrdi PIN</Text>
            <TextInput
              testID="register-confirm-pin-input"
              style={styles.input}
              value={confirmPin}
              onChangeText={(t) => setConfirmPin(t.replace(/[^0-9]/g, '').slice(0, 4))}
              placeholder="Potvrdi"
              placeholderTextColor={Colors.muted}
              keyboardType="numeric"
              secureTextEntry
              maxLength={4}
            />
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          testID="register-submit-btn"
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.primaryBtnText}>Kreiraj nalog</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity testID="register-back-btn" onPress={() => router.back()}>
          <Text style={styles.linkText}>Nazad na prijavu</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  logo: { width: 140, height: 60, alignSelf: 'center', marginBottom: 24 },
  title: {
    fontFamily: Fonts.heading,
    fontSize: Sizes.h2,
    color: Colors.foreground,
    textAlign: 'center',
    marginBottom: 8,
  },
  phoneInfo: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: Sizes.small,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 24,
  },
  row: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  halfField: { flex: 1 },
  field: { marginBottom: 16 },
  label: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: Sizes.tiny,
    color: Colors.foreground,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: Fonts.body,
    fontSize: Sizes.body,
    color: Colors.foreground,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  inputFlex: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: Sizes.body,
    color: Colors.foreground,
    paddingVertical: 14,
  },
  error: {
    fontFamily: Fonts.body,
    fontSize: Sizes.small,
    color: Colors.danger,
    marginBottom: 12,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 9999,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: Sizes.body,
    color: Colors.white,
  },
  linkText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: Sizes.small,
    color: Colors.primary,
    textAlign: 'center',
    paddingVertical: 8,
  },
});
