import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Sizes, CardStyle } from '../src/theme';
import { userAPI } from '../src/api';
import { useAuth } from '../src/context/AuthContext';

export default function PostavkeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout, checkAuth } = useAuth();

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

  const saveProfile = async () => {
    if (!ime.trim() || !prezime.trim()) {
      Alert.alert('Greška', 'Ime i prezime su obavezni.');
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
      Alert.alert('Uspješno', 'Lični podaci su sačuvani.');
    } catch (e: any) {
      Alert.alert('Greška', e?.message || 'Greška pri čuvanju podataka.');
    } finally {
      setSavingProfile(false);
    }
  };

  const savePin = async () => {
    if (!currentPin || !newPin || !confirmPin) {
      Alert.alert('Greška', 'Popunite sva polja za promjenu PIN-a.');
      return;
    }
    if (newPin.length < 4) {
      Alert.alert('Greška', 'Novi PIN mora imati najmanje 4 cifre.');
      return;
    }
    if (newPin !== confirmPin) {
      Alert.alert('Greška', 'Novi PIN i potvrda se ne podudaraju.');
      return;
    }
    setSavingPin(true);
    try {
      await userAPI.changePin({ current_pin: currentPin, new_pin: newPin });
      Alert.alert('Uspješno', 'PIN je uspješno promijenjen.');
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } catch (e: any) {
      Alert.alert('Greška', e?.message || 'Greška pri promjeni PIN-a.');
    } finally {
      setSavingPin(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Odjava', 'Da li ste sigurni da želite da se odjavite?', [
      { text: 'Ne', style: 'cancel' },
      {
        text: 'Da', style: 'destructive',
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
        <Text style={styles.headerTitle}>Postavke</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Personal data */}
          <View style={styles.card} testID="postavke-personal-card">
            <Text style={styles.cardTitle}>Lični podaci</Text>

            <Text style={styles.label}>Ime</Text>
            <TextInput
              testID="input-ime"
              style={styles.input}
              value={ime}
              onChangeText={setIme}
              placeholder="Ime"
              placeholderTextColor={Colors.muted}
            />

            <Text style={styles.label}>Prezime</Text>
            <TextInput
              testID="input-prezime"
              style={styles.input}
              value={prezime}
              onChangeText={setPrezime}
              placeholder="Prezime"
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

            <Text style={styles.label}>Broj telefona</Text>
            <TextInput
              testID="input-phone"
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Broj telefona"
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
                : <Text style={styles.primaryBtnText}>Sačuvaj podatke</Text>}
            </TouchableOpacity>
          </View>

          {/* Change PIN */}
          <View style={styles.card} testID="postavke-pin-card">
            <Text style={styles.cardTitle}>Promjena PIN-a</Text>

            <Text style={styles.label}>Trenutni PIN</Text>
            <TextInput
              testID="input-current-pin"
              style={styles.input}
              value={currentPin}
              onChangeText={setCurrentPin}
              placeholder="Trenutni PIN"
              placeholderTextColor={Colors.muted}
              keyboardType="number-pad"
              secureTextEntry
            />

            <Text style={styles.label}>Novi PIN</Text>
            <TextInput
              testID="input-new-pin"
              style={styles.input}
              value={newPin}
              onChangeText={setNewPin}
              placeholder="Novi PIN"
              placeholderTextColor={Colors.muted}
              keyboardType="number-pad"
              secureTextEntry
            />

            <Text style={styles.label}>Potvrdi novi PIN</Text>
            <TextInput
              testID="input-confirm-pin"
              style={styles.input}
              value={confirmPin}
              onChangeText={setConfirmPin}
              placeholder="Potvrdi novi PIN"
              placeholderTextColor={Colors.muted}
              keyboardType="number-pad"
              secureTextEntry
            />

            <TouchableOpacity
              testID="save-pin-btn"
              style={[styles.primaryBtn, savingPin && { opacity: 0.6 }]}
              onPress={savePin}
              disabled={savingPin}
            >
              {savingPin
                ? <ActivityIndicator color={Colors.white} size="small" />
                : <Text style={styles.primaryBtnText}>Promijeni PIN</Text>}
            </TouchableOpacity>
          </View>

          {/* Logout */}
          <TouchableOpacity testID="postavke-logout-btn" style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Odjavi se</Text>
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
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: 9999, height: 48,
    justifyContent: 'center', alignItems: 'center', marginTop: 4,
  },
  primaryBtnText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.body, color: Colors.white },
  logoutBtn: {
    borderWidth: 2, borderColor: Colors.danger, borderRadius: 9999, height: 48,
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  logoutText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.body, color: Colors.danger },
});
