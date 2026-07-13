import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors, Fonts, Sizes } from '../../src/theme';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/api';
import CountryPicker from '../../src/components/CountryPicker';
import { countries, Country } from '../../src/data/countries';

const LOGO_URL = 'https://customer-assets.emergentagent.com/job_pilates-hub-12/artifacts/ny62z2sx_linea.png';

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    phone?: string; countryCode?: string; fromGoogle?: string;
    googleToken?: string; googleEmail?: string; googleName?: string; googleSurname?: string;
  }>();
  const { register, setUser, checkAuth } = useAuth();
  const { t } = useTranslation();

  const isGoogleFlow = params.fromGoogle === 'true' && !!params.googleToken;

  const initialCountry = params.countryCode
    ? countries.find(c => c.code === params.countryCode) || countries[0]
    : countries[0];

  const [ime, setIme] = useState(params.googleName || '');
  const [prezime, setPrezime] = useState(params.googleSurname || '');
  const [email, setEmail] = useState(params.googleEmail || '');
  const [country, setCountry] = useState<Country>(initialCountry);
  const [phone, setPhone] = useState(params.phone ? params.phone.replace(initialCountry.dial, '') : '');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleRegister = async () => {
    if (!ime.trim()) { setError(t('register.firstNameRequired')); return; }
    if (!prezime.trim()) { setError(t('register.lastNameRequired')); return; }
    const phoneNum = phone.replace(/\s/g, '');
    if (!phoneNum) { setError(t('register.phoneRequired')); return; }

    const fullPhone = `${country.dial}${phoneNum}`;
    setLoading(true);
    setError('');

    try {
      const result = await api.post('/api/auth/google/register', {
        access_token: params.googleToken,
        phone: fullPhone,
        ime: ime.trim(),
        prezime: prezime.trim(),
      });

      if (result.success && result.user) {
        setUser(result.user);
        await checkAuth();
        router.replace('/(tabs)');
      } else if (result.success) {
        await checkAuth();
        router.replace('/(tabs)');
      } else {
        setError(result.detail || t('register.registerError'));
      }
    } catch (e: any) {
      setError(e.message || t('register.registerError'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegularRegister = async () => {
    if (!ime.trim()) { setError(t('register.firstNameRequired')); return; }
    if (!prezime.trim()) { setError(t('register.lastNameRequired')); return; }
    if (!email.trim()) { setError(t('register.emailRequired')); return; }
    const phoneNum = phone.replace(/\s/g, '');
    if (!phoneNum) { setError(t('register.phoneRequired')); return; }
    if (pin.length !== 4) { setError(t('login.pinLength')); return; }
    if (pin !== confirmPin) { setError(t('login.pinMismatch')); return; }

    const fullPhone = params.phone || `${country.dial}${phoneNum}`;
    setLoading(true);
    setError('');

    try {
      await register({
        phone: fullPhone,
        ime: ime.trim(),
        prezime: prezime.trim(),
        email: email.trim(),
        pin,
      });
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message || t('register.registerError'));
    } finally {
      setLoading(false);
    }
  };

  // ===== GOOGLE REGISTRATION (simplified) =====
  if (isGoogleFlow) {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Image source={{ uri: LOGO_URL }} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>{t('register.createAccount')}</Text>

          {/* Google email badge */}
          <View style={styles.googleBadge}>
            <Text style={styles.googleIcon}>G</Text>
            <Text style={styles.googleBadgeText}>{params.googleEmail}</Text>
          </View>

          <Text style={styles.subtitle}>{t('register.googleSubtitle')}</Text>

          {/* Name fields */}
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.label}>{t('register.firstNameLabel')}</Text>
              <TextInput
                testID="register-ime-input"
                style={styles.input}
                value={ime}
                onChangeText={setIme}
                placeholder={t('settings.firstName')}
                placeholderTextColor={Colors.muted}
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>{t('register.lastNameLabel')}</Text>
              <TextInput
                testID="register-prezime-input"
                style={styles.input}
                value={prezime}
                onChangeText={setPrezime}
                placeholder={t('settings.lastName')}
                placeholderTextColor={Colors.muted}
              />
            </View>
          </View>

          {/* Phone with country picker */}
          <View style={styles.field}>
            <Text style={styles.label}>{t('register.phoneLabel')}</Text>
            <View style={styles.phoneRow}>
              <CountryPicker selected={country} onSelect={setCountry} />
              <View style={styles.phoneInputWrap}>
                <Feather name="phone" size={18} color={Colors.muted} style={styles.inputIcon} />
                <TextInput
                  testID="register-phone-input"
                  style={styles.inputFlex}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="61 234 567"
                  placeholderTextColor={Colors.muted}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          </View>

          <Text style={styles.noPin}>{t('register.noPinNeeded')}</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            testID="register-google-submit-btn"
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleGoogleRegister}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={Colors.white} /> : (
              <Text style={styles.primaryBtnText}>{t('register.createAccount')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity testID="register-back-btn" onPress={() => router.back()} style={styles.backLink}>
            <Text style={styles.linkText}>{t('register.backToLogin')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ===== REGULAR REGISTRATION =====
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={{ uri: LOGO_URL }} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>{t('register.createAccount')}</Text>
        <Text style={styles.subtitle}>{t('register.allFieldsRequired')}</Text>

        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={styles.label}>{t('register.firstNameLabel')}</Text>
            <TextInput testID="register-ime-input" style={styles.input} value={ime} onChangeText={setIme}
              placeholder={t('settings.firstName')} placeholderTextColor={Colors.muted} />
          </View>
          <View style={styles.halfField}>
            <Text style={styles.label}>{t('register.lastNameLabel')}</Text>
            <TextInput testID="register-prezime-input" style={styles.input} value={prezime} onChangeText={setPrezime}
              placeholder={t('settings.lastName')} placeholderTextColor={Colors.muted} />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('register.emailLabel')}</Text>
          <View style={styles.inputRow}>
            <Feather name="mail" size={18} color={Colors.muted} style={styles.inputIcon} />
            <TextInput testID="register-email-input" style={styles.inputFlex} value={email} onChangeText={setEmail}
              placeholder="email@primjer.com" placeholderTextColor={Colors.muted} keyboardType="email-address" autoCapitalize="none" />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('register.phoneLabel')}</Text>
          <View style={styles.phoneRow}>
            <CountryPicker selected={country} onSelect={setCountry} />
            <View style={styles.phoneInputWrap}>
              <Feather name="phone" size={18} color={Colors.muted} style={styles.inputIcon} />
              <TextInput testID="register-phone-input" style={styles.inputFlex} value={phone} onChangeText={setPhone}
                placeholder="61 234 567" placeholderTextColor={Colors.muted} keyboardType="phone-pad" />
            </View>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={styles.label}>{t('register.pinLabel')}</Text>
            <TextInput testID="register-pin-input" style={styles.input} value={pin}
              onChangeText={(t) => setPin(t.replace(/[^0-9]/g, '').slice(0, 4))}
              placeholder="• • • •" placeholderTextColor={Colors.muted} keyboardType="numeric" secureTextEntry maxLength={4} />
          </View>
          <View style={styles.halfField}>
            <Text style={styles.label}>{t('register.confirmPinLabel')}</Text>
            <TextInput testID="register-confirm-pin-input" style={styles.input} value={confirmPin}
              onChangeText={(t) => setConfirmPin(t.replace(/[^0-9]/g, '').slice(0, 4))}
              placeholder="• • • •" placeholderTextColor={Colors.muted} keyboardType="numeric" secureTextEntry maxLength={4} />
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity testID="register-submit-btn" style={[styles.primaryBtn, loading && styles.btnDisabled]}
          onPress={handleRegularRegister} disabled={loading}>
          {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryBtnText}>{t('register.createAccount')}</Text>}
        </TouchableOpacity>

        <TouchableOpacity testID="register-back-btn" onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.linkText}>{t('register.backToLogin')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  logo: { width: 160, height: 70, alignSelf: 'center', marginBottom: 24 },
  title: { fontFamily: Fonts.heading, fontSize: Sizes.h2, color: Colors.foreground, textAlign: 'center', marginBottom: 6 },
  subtitle: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.muted, textAlign: 'center', marginBottom: 24 },
  googleBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.inputBorder,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 16, alignSelf: 'center',
  },
  googleIcon: { fontSize: 18, fontWeight: '700', color: '#4285F4' },
  googleBadgeText: { fontFamily: Fonts.bodyMedium, fontSize: Sizes.small, color: Colors.foreground },
  noPin: {
    fontFamily: Fonts.body, fontSize: Sizes.tiny, color: Colors.primary, textAlign: 'center',
    backgroundColor: Colors.primary + '10', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16,
    marginBottom: 20, overflow: 'hidden',
  },
  row: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  halfField: { flex: 1 },
  field: { marginBottom: 16 },
  label: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.tiny, color: Colors.foreground, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontFamily: Fonts.body, fontSize: Sizes.body, color: Colors.foreground },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: 12, paddingHorizontal: 12 },
  inputIcon: { marginRight: 8 },
  inputFlex: { flex: 1, fontFamily: Fonts.body, fontSize: Sizes.body, color: Colors.foreground, paddingVertical: 14 },
  phoneRow: { flexDirection: 'row', gap: 10 },
  phoneInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: 12, paddingHorizontal: 12 },
  error: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.danger, marginBottom: 12, textAlign: 'center' },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: 9999, height: 52, justifyContent: 'center', alignItems: 'center', width: '100%', marginBottom: 16 },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.body, color: Colors.white },
  backLink: { paddingVertical: 8 },
  linkText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.small, color: Colors.primary, textAlign: 'center' },
});
