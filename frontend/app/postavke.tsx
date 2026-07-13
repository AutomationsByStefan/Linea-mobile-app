import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors, Fonts, Sizes, CardStyle } from '../src/theme';
import { userAPI } from '../src/api';
import { useAuth } from '../src/context/AuthContext';
import i18n, { LANGUAGE_KEY } from '../src/i18n';

export default function PostavkeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout, checkAuth } = useAuth();
  const { t } = useTranslation();

  const changeLanguage = async (lng: 'bs' | 'en') => {
    await i18n.changeLanguage(lng);
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.setItem(LANGUAGE_KEY, lng);
    } catch {}
  };

  // Personal data
  const [ime, setIme] = useState(user?.ime || '');
  const [prezime, setPrezime] = useState(user?.prezime || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // PIN change
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);

  const saveProfile = async () => {
    if (!ime.trim() || !prezime.trim()) {
      Alert.alert(t('common.error'), t('settings.nameRequired'));
      return;
    }
    setSavingProfile(true);
    try {
      await userAPI.updateProfile({
        ime: ime.trim(),
        prezime: prezime.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });
      // Refresh the cached user so the rest of the app sees the new data
      await checkAuth();
      Alert.alert(t('common.success'), t('settings.profileSaved'));
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || t('settings.profileSaveError'));
    } finally {
      setSavingProfile(false);
    }
  };

  const savePin = async () => {
    if (!currentPin || !newPin || !confirmPin) {
      Alert.alert(t('common.error'), t('settings.fillAllPinFields'));
      return;
    }
    if (newPin.length < 4) {
      Alert.alert(t('common.error'), t('settings.pinMinLength'));
      return;
    }
    if (newPin !== confirmPin) {
      Alert.alert(t('common.error'), t('settings.pinMismatch'));
      return;
    }
    setSavingPin(true);
    try {
      await userAPI.changePin({ old_pin: currentPin, new_pin: newPin });
      Alert.alert(t('common.success'), t('settings.pinChanged'), [
        {
          text: t('common.ok'),
          onPress: () => {
            setCurrentPin('');
            setNewPin('');
            setConfirmPin('');
          },
        },
      ]);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || t('settings.pinChangeError'));
    } finally {
      setSavingPin(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(t('settings.logoutTitle'), t('settings.logoutConfirm'), [
      { text: t('common.no'), style: 'cancel' },
      {
        text: t('common.yes'), style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity testID="postavke-back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Personal data */}
          <View style={styles.card} testID="postavke-personal-card">
            <Text style={styles.cardTitle}>{t('settings.personalData')}</Text>

            <Text style={styles.label}>{t('settings.firstName')}</Text>
            <TextInput
              testID="input-ime"
              style={styles.input}
              value={ime}
              onChangeText={setIme}
              placeholder={t('settings.firstName')}
              placeholderTextColor={Colors.muted}
            />

            <Text style={styles.label}>{t('settings.lastName')}</Text>
            <TextInput
              testID="input-prezime"
              style={styles.input}
              value={prezime}
              onChangeText={setPrezime}
              placeholder={t('settings.lastName')}
              placeholderTextColor={Colors.muted}
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              testID="input-email"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={Colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>{t('settings.phone')}</Text>
            <TextInput
              testID="input-phone"
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder={t('settings.phone')}
              placeholderTextColor={Colors.muted}
              keyboardType="phone-pad"
            />

            <TouchableOpacity
              testID="save-profile-btn"
              style={[styles.primaryBtn, savingProfile && { opacity: 0.6 }]}
              onPress={saveProfile}
              disabled={savingProfile}
            >
              {savingProfile
                ? <ActivityIndicator color={Colors.white} size="small" />
                : <Text style={styles.primaryBtnText}>{t('settings.saveData')}</Text>}
            </TouchableOpacity>
          </View>

          {/* Change PIN */}
          <View style={styles.card} testID="postavke-pin-card">
            <Text style={styles.cardTitle}>{t('settings.pinChangeTitle')}</Text>

            <Text style={styles.label}>{t('settings.currentPin')}</Text>
            <View style={styles.pinRow}>
              <TextInput
                testID="input-current-pin"
                style={styles.pinInput}
                value={currentPin}
                onChangeText={setCurrentPin}
                placeholder={t('settings.currentPin')}
                placeholderTextColor={Colors.muted}
                keyboardType="number-pad"
                secureTextEntry={!showCurrentPin}
              />
              <TouchableOpacity
                testID="toggle-current-pin"
                onPress={() => setShowCurrentPin((v) => !v)}
                style={styles.eyeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name={showCurrentPin ? 'eye-off' : 'eye'} size={18} color={Colors.muted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>{t('settings.newPin')}</Text>
            <View style={styles.pinRow}>
              <TextInput
                testID="input-new-pin"
                style={styles.pinInput}
                value={newPin}
                onChangeText={setNewPin}
                placeholder={t('settings.newPin')}
                placeholderTextColor={Colors.muted}
                keyboardType="number-pad"
                secureTextEntry={!showNewPin}
              />
              <TouchableOpacity
                testID="toggle-new-pin"
                onPress={() => setShowNewPin((v) => !v)}
                style={styles.eyeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name={showNewPin ? 'eye-off' : 'eye'} size={18} color={Colors.muted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>{t('settings.confirmNewPin')}</Text>
            <View style={styles.pinRow}>
              <TextInput
                testID="input-confirm-pin"
                style={styles.pinInput}
                value={confirmPin}
                onChangeText={setConfirmPin}
                placeholder={t('settings.confirmNewPin')}
                placeholderTextColor={Colors.muted}
                keyboardType="number-pad"
                secureTextEntry={!showConfirmPin}
              />
              <TouchableOpacity
                testID="toggle-confirm-pin"
                onPress={() => setShowConfirmPin((v) => !v)}
                style={styles.eyeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name={showConfirmPin ? 'eye-off' : 'eye'} size={18} color={Colors.muted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              testID="save-pin-btn"
              style={[styles.primaryBtn, savingPin && { opacity: 0.6 }]}
              onPress={savePin}
              disabled={savingPin}
            >
              {savingPin
                ? <ActivityIndicator color={Colors.white} size="small" />
                : <Text style={styles.primaryBtnText}>{t('settings.changePin')}</Text>}
            </TouchableOpacity>
          </View>

          {/* Language */}
          <View style={styles.card} testID="postavke-language-card">
            <Text style={styles.cardTitle}>{t('settings.language')}</Text>
            <View style={styles.langRow}>
              <TouchableOpacity
                testID="lang-bs-btn"
                style={[styles.langBtn, i18n.language === 'bs' && styles.langBtnActive]}
                onPress={() => changeLanguage('bs')}
              >
                <Text style={[styles.langBtnText, i18n.language === 'bs' && styles.langBtnTextActive]}>
                  Bosanski
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="lang-en-btn"
                style={[styles.langBtn, i18n.language === 'en' && styles.langBtnActive]}
                onPress={() => changeLanguage('en')}
              >
                <Text style={[styles.langBtnText, i18n.language === 'en' && styles.langBtnTextActive]}>
                  English
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Logout */}
          <TouchableOpacity testID="postavke-logout-btn" style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>{t('settings.logout')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  card: { ...CardStyle, marginBottom: 16 },
  cardTitle: { fontFamily: Fonts.heading, fontSize: 18, color: Colors.foreground, marginBottom: 16 },
  label: { fontFamily: Fonts.bodyMedium, fontSize: Sizes.small, color: Colors.muted, marginBottom: 6 },
  input: {
    backgroundColor: Colors.background, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    fontFamily: Fonts.body, fontSize: Sizes.body, color: Colors.foreground,
    marginBottom: 14, borderWidth: 1, borderColor: Colors.inputBorder,
  },
  pinRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.background, borderRadius: 12, paddingHorizontal: 16,
    marginBottom: 14, borderWidth: 1, borderColor: Colors.inputBorder,
  },
  pinInput: {
    flex: 1, paddingVertical: 12,
    fontFamily: Fonts.body, fontSize: Sizes.body, color: Colors.foreground,
  },
  eyeBtn: { paddingLeft: 12, paddingVertical: 4 },
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: 9999, height: 48,
    justifyContent: 'center', alignItems: 'center', marginTop: 4,
  },
  primaryBtnText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.body, color: Colors.white },
  langRow: { flexDirection: 'row', gap: 10 },
  langBtn: {
    flex: 1, height: 44, borderRadius: 9999,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.inputBorder, backgroundColor: Colors.background,
  },
  langBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  langBtnText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.body, color: Colors.foreground },
  langBtnTextActive: { color: Colors.white },
  logoutBtn: {
    borderWidth: 2, borderColor: Colors.danger, borderRadius: 9999, height: 48,
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  logoutText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.body, color: Colors.danger },
});
