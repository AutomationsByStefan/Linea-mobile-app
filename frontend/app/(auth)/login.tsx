import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Sizes, Spacing } from '../../src/theme';
import { authAPI } from '../../src/api';
import { useAuth } from '../../src/context/AuthContext';
import CountryPicker from '../../src/components/CountryPicker';
import { countries, Country } from '../../src/data/countries';

const LOGO_URL = 'https://customer-assets.emergentagent.com/job_pilates-hub-12/artifacts/ny62z2sx_linea.png';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [step, setStep] = useState<'phone' | 'pin'>('phone');
  const [country, setCountry] = useState<Country>(countries[0]);
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [userName, setUserName] = useState('');
  const [fullPhone, setFullPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePhoneCheck = async () => {
    const num = phone.replace(/\s/g, '');
    if (!num) { setError('Unesite broj telefona'); return; }
    const full = `${country.dial}${num}`;
    setFullPhone(full);
    setLoading(true);
    setError('');

    try {
      const res = await authAPI.checkPhone(full);
      if (res.exists) {
        setUserName(res.ime || res.name || 'Korisnik');
        setStep('pin');
      } else {
        router.push({ pathname: '/(auth)/register', params: { phone: full } });
      }
    } catch (e: any) {
      setError(e.message || 'Greška pri provjeri broja');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (pin.length !== 4) { setError('PIN mora imati 4 cifre'); return; }
    setLoading(true);
    setError('');

    try {
      await login(fullPhone, pin);
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message || 'Pogrešan PIN');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'pin') {
    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Image source={{ uri: LOGO_URL }} style={styles.logo} resizeMode="contain" testID="login-logo" />
          <Text style={styles.title}>Zdravo, {userName}</Text>
          <Text style={styles.subtitle}>Unesite vaš 4-cifreni PIN</Text>

          <View style={styles.pinContainer}>
            <Feather name="lock" size={18} color={Colors.muted} style={styles.inputIcon} />
            <TextInput
              testID="pin-input"
              style={styles.pinInput}
              value={pin}
              onChangeText={(t) => setPin(t.replace(/[^0-9]/g, '').slice(0, 4))}
              keyboardType="numeric"
              secureTextEntry
              maxLength={4}
              placeholder="• • • •"
              placeholderTextColor={Colors.muted}
              textAlign="center"
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            testID="login-submit-btn"
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.primaryBtnText}>Prijavi se</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity testID="login-back-btn" onPress={() => { setStep('phone'); setPin(''); setError(''); }}>
            <Text style={styles.linkText}>Nazad</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={{ uri: LOGO_URL }} style={styles.logo} resizeMode="contain" testID="login-logo" />
        <Text style={styles.title}>Dobrodošli</Text>
        <Text style={styles.subtitle}>Unesite broj telefona za prijavu</Text>

        <View style={styles.phoneRow}>
          <CountryPicker selected={country} onSelect={setCountry} />
          <View style={styles.phoneInputWrap}>
            <Feather name="phone" size={18} color={Colors.muted} style={styles.inputIcon} />
            <TextInput
              testID="phone-input"
              style={styles.phoneInput}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="61 234 567"
              placeholderTextColor={Colors.muted}
            />
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          testID="phone-continue-btn"
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          onPress={handlePhoneCheck}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.primaryBtnText}>Nastavi</Text>
          )}
        </TouchableOpacity>

        <View style={styles.separator}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorText}>ili</Text>
          <View style={styles.separatorLine} />
        </View>

        <TouchableOpacity testID="login-back-link" onPress={() => router.push('/(auth)/register')}>
          <Text style={styles.linkText}>Nemate nalog? Registrujte se</Text>
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
    alignItems: 'center',
  },
  logo: { width: 180, height: 80, marginBottom: 32 },
  title: {
    fontFamily: Fonts.heading,
    fontSize: Sizes.h2,
    color: Colors.foreground,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: Sizes.small,
    color: Colors.muted,
    marginBottom: 32,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginBottom: 16,
  },
  phoneInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  phoneInput: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: Sizes.body,
    color: Colors.foreground,
    paddingVertical: 14,
  },
  pinContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    width: '100%',
    marginBottom: 16,
  },
  pinInput: {
    flex: 1,
    fontFamily: Fonts.bodyBold,
    fontSize: 24,
    color: Colors.foreground,
    paddingVertical: 14,
    letterSpacing: 16,
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
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 16,
  },
  separatorLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  separatorText: {
    fontFamily: Fonts.body,
    fontSize: Sizes.small,
    color: Colors.muted,
    marginHorizontal: 16,
  },
  linkText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: Sizes.small,
    color: Colors.primary,
    textAlign: 'center',
    paddingVertical: 8,
  },
});
