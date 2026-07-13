import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { Colors, Fonts, Sizes } from '../../src/theme';
import { authAPI, api } from '../../src/api';
import { useAuth } from '../../src/context/AuthContext';
import CountryPicker from '../../src/components/CountryPicker';
import { countries, Country } from '../../src/data/countries';

WebBrowser.maybeCompleteAuthSession();

const LOGO_URL = 'https://customer-assets.emergentagent.com/job_pilates-hub-12/artifacts/ny62z2sx_linea.png';

// Google OAuth — Web Application Client ID
const GOOGLE_CLIENT_ID = '1085993530181-g4cnkler2rr97b1sob4b57biqfj15id3.apps.googleusercontent.com';

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, setUser, checkAuth } = useAuth();
  const { t } = useTranslation();

  const [step, setStep] = useState<'phone' | 'pin'>('phone');
  const [country, setCountry] = useState<Country>(countries[0]);
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [userName, setUserName] = useState('');
  const [fullPhone, setFullPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const [forgotVisible, setForgotVisible] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showForgotNewPin, setShowForgotNewPin] = useState(false);
  const [showForgotConfirmPin, setShowForgotConfirmPin] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');

  // Build redirect URI using Expo auth proxy
  const redirectUri = 'https://auth.expo.io/@creativetechologies/linea-pilates';

  // Google Auth — implicit flow, no PKCE, using Expo proxy
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
  {
    clientId: GOOGLE_CLIENT_ID,
    scopes: ['profile', 'email'],
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
  },
  discovery
);

  // Handle Google auth response
  useEffect(() => {
    if (response?.type === 'success' && response.params?.code) {
  handleGoogleCode(response.params.code, request?.codeVerifier || '');
    } else if (response?.type === 'error') {
      setError(t('login.googleFailed'));
      setGoogleLoading(false);
    }
  }, [response]);

  const handleGoogleToken = async (accessToken: string) => {
    setGoogleLoading(true);
    setError('');
    try {
      const result = await api.post('/api/auth/google/mobile', { access_token: accessToken });

      if (result.exists && result.user) {
        // User exists — auto-logged in, session cookie set by backend
        setUser(result.user);
        await checkAuth();
        router.replace('/(tabs)');
      } else if (!result.exists) {
        // New user — go to Google registration (simplified)
        router.push({
          pathname: '/(auth)/register',
          params: {
            fromGoogle: 'true',
            googleToken: accessToken,
            googleEmail: result.email || '',
            googleName: result.given_name || '',
            googleSurname: result.family_name || '',
          },
        });
      }
    } catch (e: any) {
      setError(e.message || t('login.googleError'));
    } finally {
      setGoogleLoading(false);
    }
  };
  
  const handleGoogleCode = async (code: string, codeVerifier: string) => {
  setGoogleLoading(true);
  setError('');
  try {
    const result = await api.post('/api/auth/google/exchange-code', {
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    });
    if (result.exists && result.user) {
      setUser(result.user);
      await checkAuth();
      router.replace('/(tabs)');
    } else if (!result.exists) {
      router.push({
        pathname: '/(auth)/register',
        params: {
          fromGoogle: 'true',
          googleEmail: result.email || '',
          googleName: result.given_name || '',
          googleSurname: result.family_name || '',
        },
      });
    }
  } catch (e: any) {
    setError(e.message || 'Greška pri Google prijavi');
  } finally {
    setGoogleLoading(false);
  }
};
  
  const handlePhoneCheck = async () => {
    const num = phone.replace(/\s/g, '');
    if (!num) { setError(t('login.enterPhone')); return; }
    const full = `${country.dial}${num}`;
    setFullPhone(full);
    setLoading(true);
    setError('');

    try {
      const res = await authAPI.checkPhone(full);
      if (res.exists) {
        setUserName(res.name || res.ime || t('login.defaultUser'));
        setStep('pin');
      } else {
        router.push({ pathname: '/(auth)/register', params: { phone: full, countryCode: country.code } });
      }
    } catch (e: any) {
      setError(e.message || t('login.phoneCheckError'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (pin.length !== 4) { setError(t('login.pinLength')); return; }
    setLoading(true);
    setError('');

    try {
      await login(fullPhone, pin);
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message || t('login.wrongPin'));
    } finally {
      setLoading(false);
    }
  };

  const openForgotPin = () => {
    setForgotEmail('');
    setForgotCode('');
    setNewPin('');
    setConfirmPin('');
    setShowForgotNewPin(false);
    setShowForgotConfirmPin(false);
    setForgotError('');
    setForgotStep(1);
    setForgotVisible(true);
  };

  const handleSendCode = async () => {
    if (!forgotEmail.trim()) { setForgotError(t('login.enterEmail')); return; }
    setForgotLoading(true);
    setForgotError('');
    try {
      await api.post('/api/auth/forgot-pin', { email: forgotEmail.trim() });
      setForgotStep(2);
    } catch (e: any) {
      setForgotError(e.message || t('login.sendCodeError'));
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPin = async () => {
    if (forgotCode.length !== 6) { setForgotError(t('login.enterCode')); return; }
    if (newPin.length !== 4) { setForgotError(t('login.pinLength')); return; }
    if (newPin !== confirmPin) { setForgotError(t('login.pinMismatch')); return; }
    setForgotLoading(true);
    setForgotError('');
    try {
      await api.post('/api/auth/reset-pin', { email: forgotEmail.trim(), code: forgotCode, new_pin: newPin });
      setForgotVisible(false);
      Alert.alert(t('login.resetSuccessTitle'), t('login.resetSuccessMsg'));
    } catch (e: any) {
      setForgotError(e.message || t('login.resetError'));
    } finally {
      setForgotLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!GOOGLE_CLIENT_ID) {
      Alert.alert(
        t('login.googleSignIn'),
        t('login.googleNotConfigured'),
      );
      return;
    }
    setGoogleLoading(true);
    setError('');
    promptAsync();
  };

  if (step === 'pin') {
    return (
      <>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 60, flexGrow: 1, justifyContent: 'center' }]}
          keyboardShouldPersistTaps="handled"
        >
          <Image source={{ uri: LOGO_URL }} style={styles.logoLarge} resizeMode="contain" testID="login-logo" />
          <Text style={styles.title}>{t('login.hello', { name: userName })}</Text>
          <Text style={styles.subtitle}>{t('login.enterPinSubtitle')}</Text>

          <View style={styles.inputContainer}>
            <Feather name="lock" size={18} color={Colors.muted} style={styles.inputIcon} />
            <TextInput
              testID="pin-input"
              style={styles.pinInput}
              value={pin}
              onChangeText={(t) => setPin(t.replace(/[^0-9]/g, '').slice(0, 4))}
              keyboardType="numeric"
              secureTextEntry={!showPin}
              maxLength={4}
              placeholder="• • • •"
              placeholderTextColor={Colors.muted}
              textAlign="center"
            />
            <TouchableOpacity
              testID="toggle-pin"
              onPress={() => setShowPin((v) => !v)}
              style={styles.eyeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name={showPin ? 'eye-off' : 'eye'} size={18} color={Colors.muted} />
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            testID="login-submit-btn"
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={Colors.white} /> : (
              <Text style={styles.primaryBtnText}>{t('login.signIn')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity testID="login-back-btn" onPress={() => { setStep('phone'); setPin(''); setError(''); }}>
            <Text style={styles.linkText}>{t('common.back')}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={openForgotPin}>
            <Text style={styles.forgotText}>{t('login.forgotPin')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={forgotVisible} animationType="slide" transparent={false} onRequestClose={() => setForgotVisible(false)}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 60, flexGrow: 1, justifyContent: 'center' }]}
            keyboardShouldPersistTaps="handled"
          >
            <Image source={{ uri: LOGO_URL }} style={styles.logoLarge} resizeMode="contain" />

            {forgotStep === 1 ? (
              <>
                <Text style={styles.title}>{t('login.resetPin')}</Text>
                <Text style={styles.subtitle}>{t('login.resetPinSubtitle')}</Text>

                <View style={styles.inputContainer}>
                  <Feather name="mail" size={18} color={Colors.muted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={forgotEmail}
                    onChangeText={setForgotEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder={t('login.emailPlaceholder')}
                    placeholderTextColor={Colors.muted}
                  />
                </View>

                {forgotError ? <Text style={styles.error}>{forgotError}</Text> : null}

                <TouchableOpacity
                  style={[styles.primaryBtn, forgotLoading && styles.btnDisabled]}
                  onPress={handleSendCode}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? <ActivityIndicator color={Colors.white} /> : (
                    <Text style={styles.primaryBtnText}>{t('login.sendCode')}</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.title}>{t('login.enterCodeTitle')}</Text>
                <Text style={styles.subtitle}>{t('login.codeSentSubtitle')}</Text>

                <View style={styles.inputContainer}>
                  <Feather name="hash" size={18} color={Colors.muted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={forgotCode}
                    onChangeText={(t) => setForgotCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
                    keyboardType="numeric"
                    placeholder={t('login.codePlaceholder')}
                    placeholderTextColor={Colors.muted}
                    maxLength={6}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Feather name="lock" size={18} color={Colors.muted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={newPin}
                    onChangeText={(t) => setNewPin(t.replace(/[^0-9]/g, '').slice(0, 4))}
                    keyboardType="numeric"
                    secureTextEntry={!showForgotNewPin}
                    placeholder={t('login.newPinPlaceholder')}
                    placeholderTextColor={Colors.muted}
                    maxLength={4}
                  />
                  <TouchableOpacity
                    testID="toggle-forgot-new-pin"
                    onPress={() => setShowForgotNewPin((v) => !v)}
                    style={styles.eyeBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name={showForgotNewPin ? 'eye-off' : 'eye'} size={18} color={Colors.muted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputContainer}>
                  <Feather name="lock" size={18} color={Colors.muted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={confirmPin}
                    onChangeText={(t) => setConfirmPin(t.replace(/[^0-9]/g, '').slice(0, 4))}
                    keyboardType="numeric"
                    secureTextEntry={!showForgotConfirmPin}
                    placeholder={t('login.confirmNewPinPlaceholder')}
                    placeholderTextColor={Colors.muted}
                    maxLength={4}
                  />
                  <TouchableOpacity
                    testID="toggle-forgot-confirm-pin"
                    onPress={() => setShowForgotConfirmPin((v) => !v)}
                    style={styles.eyeBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name={showForgotConfirmPin ? 'eye-off' : 'eye'} size={18} color={Colors.muted} />
                  </TouchableOpacity>
                </View>

                {forgotError ? <Text style={styles.error}>{forgotError}</Text> : null}

                <TouchableOpacity
                  style={[styles.primaryBtn, forgotLoading && styles.btnDisabled]}
                  onPress={handleResetPin}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? <ActivityIndicator color={Colors.white} /> : (
                    <Text style={styles.primaryBtnText}>{t('login.resetPin')}</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity onPress={() => {
              if (forgotStep === 2) {
                setForgotStep(1);
                setForgotCode('');
                setNewPin('');
                setConfirmPin('');
                setForgotError('');
              } else {
                setForgotVisible(false);
              }
            }}>
              <Text style={styles.linkText}>{t('common.back')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
      </>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 60, flexGrow: 1, justifyContent: 'center' }]}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={{ uri: LOGO_URL }} style={styles.logoLarge} resizeMode="contain" testID="login-logo" />
        <Text style={styles.title}>{t('login.welcome')}</Text>
        <Text style={styles.subtitle}>{t('login.enterPhoneSubtitle')}</Text>

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
          {loading ? <ActivityIndicator color={Colors.white} /> : (
            <Text style={styles.primaryBtnText}>{t('login.continue')}</Text>
          )}
        </TouchableOpacity>
{false && (
        <View style={styles.separator}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorText}>{t('login.or')}</Text>
          <View style={styles.separatorLine} />
        </View>
)}
        {false && (
        <TouchableOpacity
          testID="google-signin-btn"
          style={[styles.googleBtn, googleLoading && styles.btnDisabled]}
          onPress={handleGoogleSignIn}
          disabled={googleLoading}
        >
          {googleLoading ? <ActivityIndicator color={Colors.foreground} /> : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleBtnText}>{t('login.signInWithGoogle')}</Text>
            </>
          )}
        </TouchableOpacity>
  )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingBottom: 40,
    alignItems: 'center',
  },
  logoLarge: { width: 240, height: 160, marginBottom: 40 },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 26,
    color: Colors.foreground,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: Sizes.body,
    color: Colors.muted,
    marginBottom: 36,
    textAlign: 'center',
  },
  phoneRow: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 20 },
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
  eyeBtn: { paddingLeft: 8 },
  phoneInput: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: Sizes.body,
    color: Colors.foreground,
    paddingVertical: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    width: '100%',
    marginBottom: 20,
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
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.body, color: Colors.white },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 16,
  },
  separatorLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  separatorText: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.muted, marginHorizontal: 16 },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 52,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 9999,
    gap: 10,
  },
  googleIcon: { fontSize: 20, fontWeight: '700', color: '#4285F4' },
  googleBtnText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.body, color: Colors.foreground },
  linkText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: Sizes.small,
    color: Colors.primary,
    textAlign: 'center',
    paddingVertical: 8,
  },
  forgotText: {
    fontFamily: Fonts.body,
    fontSize: Sizes.small,
    color: Colors.muted,
    textAlign: 'center',
    paddingVertical: 8,
    textDecorationLine: 'underline',
  },
  textInput: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: Sizes.body,
    color: Colors.foreground,
    paddingVertical: 14,
  },
});
