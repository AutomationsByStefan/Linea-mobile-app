import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  RefreshControl, ActivityIndicator, TextInput, Modal, Alert, FlatList,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Sizes, CardStyle, formatDateShort } from '../../src/theme';
import { api } from '../../src/api';
import { useAuth } from '../../src/context/AuthContext';

type Section = 'dashboard' | 'schedule' | 'bookings' | 'users';

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [section, setSection] = useState<Section>('dashboard');

  if (!user?.is_admin) {
    return (
      <View style={[s.centered, { paddingTop: insets.top }]}>
        <Feather name="shield-off" size={48} color={Colors.muted} />
        <Text style={s.emptyText}>Nemate pristup admin panelu</Text>
      </View>
    );
  }

  const tabs: { key: Section; label: string; icon: string }[] = [
    { key: 'dashboard', label: 'Kontrolna', icon: 'grid' },
    { key: 'schedule', label: 'Raspored', icon: 'calendar' },
    { key: 'bookings', label: 'Rezervacije', icon: 'book-open' },
    { key: 'users', label: 'Korisnici', icon: 'users' },
  ];

  return (
    <View style={s.flex}>
      {/* Top Tab Bar */}
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <Text style={s.topTitle}>Admin Panel</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabRow}>
          {tabs.map(t => (
            <TouchableOpacity
              key={t.key}
              testID={`admin-tab-${t.key}`}
              style={[s.tab, section === t.key && s.tabActive]}
              onPress={() => setSection(t.key)}
            >
              <Feather name={t.icon as any} size={16} color={section === t.key ? Colors.white : Colors.primary} />
              <Text style={[s.tabText, section === t.key && s.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {section === 'dashboard' && <DashboardSection />}
      {section === 'schedule' && <ScheduleSection />}
      {section === 'bookings' && <BookingsSection />}
      {section === 'users' && <UsersSection />}
    </View>
  );
}

// ============= DASHBOARD =============
function DashboardSection() {
  const [stats, setStats] = useState<any>(null);
  const [reminders, setReminders] = useState<any[]>([]);
  const [finance, setFinance] = useState<any>(null);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newReminder, setNewReminder] = useState('');
  const [showWarnings, setShowWarnings] = useState(false);
  const [warnings, setWarnings] = useState<any[]>([]);
  const [showManualIncome, setShowManualIncome] = useState(false);
  const [manualAmount, setManualAmount] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualCat, setManualCat] = useState('Ostalo');

  const load = useCallback(async () => {
    try {
      const [st, rem, fin, usr] = await Promise.allSettled([
        api.get('/api/admin/stats'),
        api.get('/api/admin/reminders'),
        api.get('/api/admin/finance'),
        api.get('/api/admin/users'),
      ]);
      if (st.status === 'fulfilled') setStats(st.value);
      if (rem.status === 'fulfilled') setReminders(Array.isArray(rem.value) ? rem.value : []);
      if (fin.status === 'fulfilled') setFinance(fin.value);
      if (usr.status === 'fulfilled') {
        const list = Array.isArray(usr.value) ? usr.value : [];
        setRecentUsers(list.sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 5));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const addReminder = async () => {
    if (!newReminder.trim()) return;
    try {
      await api.post('/api/admin/reminders', { tekst: newReminder.trim() });
      setNewReminder('');
      await load();
    } catch (e) { console.error(e); }
  };

  const deleteReminder = async (id: string) => {
    try { await api.delete(`/api/admin/reminders/${id}`); await load(); } catch (e) { console.error(e); }
  };

  const loadWarnings = async () => {
    try {
      const w = await api.get('/api/admin/warnings');
      setWarnings(Array.isArray(w) ? w : []);
    } catch (e) { console.error(e); }
    setShowWarnings(true);
  };

  const addManualIncome = async () => {
    const amt = parseFloat(manualAmount);
    if (isNaN(amt) || amt <= 0) { Alert.alert('Greška', 'Unesite validan iznos'); return; }
    try {
      await api.post('/api/admin/finance/manual', { amount: amt, description: manualDesc, category: manualCat });
      setShowManualIncome(false);
      setManualAmount(''); setManualDesc(''); setManualCat('Ostalo');
      await load();
    } catch (e: any) { Alert.alert('Greška', e.message || 'Greška'); }
  };

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  const currentMonth = finance?.months?.[0];

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>
      <Text style={s.sectionTitle}>Kontrolna tabla</Text>

      {/* Stats Cards */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.statsRow}>
        {[
          { label: 'Korisnici', value: stats?.total_users || 0, icon: 'users', color: '#7C3AED' },
          { label: 'Aktivne članarine', value: stats?.active_memberships || 0, icon: 'credit-card', color: '#059669' },
          { label: 'Današnji treninzi', value: stats?.today_trainings || 0, icon: 'calendar', color: Colors.primary },
          { label: 'Zahtjevi na čekanju', value: stats?.pending_requests || 0, icon: 'clock', color: '#2563EB' },
          { label: 'Prihod (mjesec)', value: `${stats?.monthly_income || 0} KM`, icon: 'dollar-sign', color: '#D97706' },
        ].map((c, i) => (
          <View key={i} style={s.statCard}>
            <View style={[s.statIcon, { backgroundColor: c.color + '20' }]}>
              <Feather name={c.icon as any} size={18} color={c.color} />
            </View>
            <Text style={s.statValue}>{c.value}</Text>
            <Text style={s.statLabel}>{c.label}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Reminders */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <Text style={s.cardTitle}>Podsjetnici ({reminders.length})</Text>
          <TouchableOpacity testID="show-warnings-btn" style={s.warningBtn} onPress={loadWarnings}>
            <Feather name="alert-triangle" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>
        <View style={s.reminderInput}>
          <TextInput style={s.reminderTextInput} placeholder="Novi podsjetnik..." placeholderTextColor={Colors.muted}
            value={newReminder} onChangeText={setNewReminder} />
          <TouchableOpacity testID="add-reminder-btn" style={s.addBtn} onPress={addReminder}>
            <Feather name="plus" size={18} color={Colors.white} />
          </TouchableOpacity>
        </View>
        {reminders.map((r: any) => (
          <View key={r.id || r._id} style={s.reminderRow}>
            <Text style={s.reminderText}>{r.tekst || r.text}</Text>
            <TouchableOpacity onPress={() => deleteReminder(r.id || r._id)}>
              <Feather name="trash-2" size={16} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Finance */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <Text style={s.cardTitle}>Finansijski pregled</Text>
          <TouchableOpacity testID="manual-income-btn" style={s.goldBtn} onPress={() => setShowManualIncome(true)}>
            <Feather name="plus" size={14} color={Colors.white} />
            <Text style={s.goldBtnText}>Ručni prihod</Text>
          </TouchableOpacity>
        </View>
        {currentMonth && (
          <>
            <View style={s.financeRow}>
              <View style={s.finBox}><Text style={s.finLabel}>Ukupno</Text><Text style={s.finValue}>{currentMonth.total} KM</Text></View>
              <View style={s.finBox}><Text style={s.finLabel}>Paketi</Text><Text style={s.finValue}>{currentMonth.total - (currentMonth.manual?.reduce((a: number, m: any) => a + (m.amount || 0), 0) || 0)} KM</Text></View>
              <View style={s.finBox}><Text style={s.finLabel}>Ručno</Text><Text style={s.finValue}>{currentMonth.manual?.reduce((a: number, m: any) => a + (m.amount || 0), 0) || 0} KM</Text></View>
            </View>
            {Object.entries(currentMonth.packages || {}).map(([name, data]: any) => (
              <View key={name} style={s.finPkgRow}>
                <Text style={s.finPkgName}>{name}</Text>
                <Text style={s.finPkgPrice}>{data.total} KM ({data.count}x)</Text>
              </View>
            ))}
          </>
        )}
      </View>

      {/* Recent Users */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Posljednji korisnici</Text>
        {recentUsers.map((u: any) => (
          <View key={u.user_id} style={s.userRow}>
            <View>
              <Text style={s.userName}>{u.name}</Text>
              <Text style={s.userSub}>{u.email || u.phone}</Text>
            </View>
            <Text style={s.userDate}>{(u.created_at || '').slice(0, 10)}</Text>
          </View>
        ))}
      </View>

      {/* Warnings Modal */}
      <Modal visible={showWarnings} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Upozorenja ({warnings.length})</Text>
              <TouchableOpacity onPress={() => setShowWarnings(false)}><Feather name="x" size={22} color={Colors.foreground} /></TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {warnings.length === 0 ? <Text style={s.emptyText}>Nema upozorenja</Text> :
                warnings.map((w: any, i: number) => (
                  <View key={i} style={s.warningRow}>
                    <Text style={s.userName}>{w.name}</Text>
                    <Text style={[s.userSub, { color: Colors.danger }]}>{w.message}</Text>
                    <Text style={s.userSub}>{w.phone}</Text>
                  </View>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Manual Income Modal */}
      <Modal visible={showManualIncome} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Ručni prihod</Text>
            <TextInput style={s.modalInput} placeholder="Iznos (KM)" placeholderTextColor={Colors.muted}
              value={manualAmount} onChangeText={setManualAmount} keyboardType="decimal-pad" />
            <TextInput style={s.modalInput} placeholder="Opis (npr. Prodaja opreme)" placeholderTextColor={Colors.muted}
              value={manualDesc} onChangeText={setManualDesc} />
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalBtnCancel} onPress={() => setShowManualIncome(false)}>
                <Text style={s.modalBtnCancelText}>Odustani</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalBtnConfirm} onPress={addManualIncome}>
                <Text style={s.modalBtnConfirmText}>Sačuvaj</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ============= SCHEDULE =============
function ScheduleSection() {
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get('/api/admin/schedule');
      setSlots(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const generate = async () => {
    try {
      const res = await api.post('/api/admin/schedule/generate', { days: 7 });
      Alert.alert('Generisano', res.message || 'Termini generisani');
      await load();
    } catch (e: any) { Alert.alert('Greška', e.message || 'Greška'); }
  };

  const deleteSlot = async (id: string) => {
    try { await api.delete(`/api/admin/schedule/${id}`); await load(); }
    catch (e: any) { Alert.alert('Greška', e.message || 'Greška'); }
  };

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  const grouped: Record<string, any[]> = {};
  slots.forEach(sl => { const d = sl.datum; if (!grouped[d]) grouped[d] = []; grouped[d].push(sl); });
  const dates = Object.keys(grouped).sort();

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>
      <View style={s.cardHeader}>
        <Text style={s.sectionTitle}>Raspored</Text>
        <TouchableOpacity testID="generate-schedule-btn" style={s.goldBtn} onPress={generate}>
          <Feather name="refresh-cw" size={14} color={Colors.white} />
          <Text style={s.goldBtnText}>Generiši dane</Text>
        </TouchableOpacity>
      </View>

      {dates.map(date => (
        <View key={date} style={s.scheduleDay}>
          <Text style={s.scheduleDateLabel}>{date}</Text>
          <View style={s.slotGrid}>
            {grouped[date].sort((a: any, b: any) => a.vrijeme.localeCompare(b.vrijeme)).map((sl: any) => (
              <View key={sl.id} style={s.slotCard} testID={`admin-slot-${sl.id}`}>
                <View style={s.slotHeader}>
                  <Text style={s.slotTime}>{sl.vrijeme}</Text>
                  <TouchableOpacity onPress={() => deleteSlot(sl.id)}>
                    <Feather name="trash-2" size={14} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
                <Text style={s.slotInstructor}>{sl.instruktor}</Text>
                <Text style={[s.slotSpots, (sl.slobodna_mjesta || 0) < (sl.ukupno_mjesta || 3) && { color: Colors.danger }]}>
                  {sl.slobodna_mjesta || 0}/{sl.ukupno_mjesta || 3} mjesta
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ============= BOOKINGS =============
function BookingsSection() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get('/api/admin/bookings');
      setBookings(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const cancelBooking = async (id: string) => {
    Alert.alert('Otkaži', 'Da li ste sigurni?', [
      { text: 'Ne', style: 'cancel' },
      { text: 'Da', style: 'destructive', onPress: async () => {
        try { await api.post(`/api/admin/bookings/${id}/cancel`, { reason: 'admin' }); await load(); }
        catch (e: any) { Alert.alert('Greška', e.message || 'Greška'); }
      }},
    ]);
  };

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  const filters = ['all', 'upcoming', 'completed', 'cancelled'];
  const filterLabels: Record<string, string> = { all: 'Svi', upcoming: 'Predstojeći', completed: 'Završeni', cancelled: 'Otkazani' };
  const statusColors: Record<string, string> = { upcoming: '#2563EB', completed: '#059669', cancelled: Colors.danger, predstojeći: '#2563EB', završeni: '#059669', otkazani: Colors.danger };

  const filtered = bookings.filter(b => {
    if (filter === 'all') return true;
    const st = (b.status || b.tip || '').toLowerCase();
    if (filter === 'upcoming') return st.includes('predstojeć') || st === 'upcoming';
    if (filter === 'completed') return st.includes('završen') || st === 'completed';
    if (filter === 'cancelled') return st.includes('otkazan') || st === 'cancelled';
    return true;
  });

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>
      <Text style={s.sectionTitle}>Rezervacije</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
        {filters.map(f => (
          <TouchableOpacity key={f} style={[s.filterBtn, filter === f && s.filterBtnActive]} onPress={() => setFilter(f)}>
            <Text style={[s.filterText, filter === f && s.filterTextActive]}>{filterLabels[f]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 ? <Text style={s.emptyText}>Nema rezervacija</Text> :
        filtered.map((b: any) => {
          const st = (b.status || b.tip || 'upcoming').toLowerCase();
          const color = statusColors[st] || Colors.muted;
          const label = st.includes('predstojeć') || st === 'upcoming' ? 'Predstojeći' :
            st.includes('završen') || st === 'completed' ? 'Završeni' :
            st.includes('otkazan') || st === 'cancelled' ? 'Otkazani' : st;
          return (
            <View key={b.id || b._id} style={s.bookingCard}>
              <View style={s.bookingInfo}>
                <Text style={s.userName}>{b.user_name || b.name || 'Korisnik'}</Text>
                <Text style={s.userSub}>{b.user_email || b.email || ''}</Text>
              </View>
              <Text style={s.bookingDate}>{(b.datum || b.date || '').slice(0, 10)}</Text>
              <Text style={s.bookingTime}>{b.vrijeme || b.time}</Text>
              <View style={[s.statusBadge, { backgroundColor: color + '20' }]}>
                <Text style={[s.statusText, { color }]}>{label}</Text>
              </View>
              {(st.includes('predstojeć') || st === 'upcoming') && (
                <TouchableOpacity onPress={() => cancelBooking(b.id || b._id)} style={s.cancelBtn}>
                  <Feather name="x-circle" size={16} color={Colors.danger} />
                </TouchableOpacity>
              )}
            </View>
          );
        })}
    </ScrollView>
  );
}

// ============= USERS =============
function UsersSection() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [noteModal, setNoteModal] = useState<any>(null);
  const [noteText, setNoteText] = useState('');
  const [historyModal, setHistoryModal] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any>(null);
  const [memberModal, setMemberModal] = useState<any>(null);
  const [selectedPkg, setSelectedPkg] = useState('');
  const [packages, setPackages] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const [u, p] = await Promise.allSettled([api.get('/api/admin/users'), api.get('/api/packages')]);
      if (u.status === 'fulfilled') setUsers(Array.isArray(u.value) ? u.value : []);
      if (p.status === 'fulfilled') setPackages(Array.isArray(p.value) ? p.value : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.name || '').toLowerCase().includes(q) || (u.phone || '').includes(q) || (u.email || '').toLowerCase().includes(q);
  });

  const saveNote = async () => {
    if (!noteModal) return;
    try {
      await api.put(`/api/admin/users/${noteModal.user_id}/notes`, { notes: noteText });
      setNoteModal(null);
      await load();
    } catch (e: any) { Alert.alert('Greška', e.message || 'Greška'); }
  };

  const loadHistory = async (u: any) => {
    setHistoryModal(u);
    try {
      const data = await api.get(`/api/admin/users/${u.user_id}/history`);
      setHistoryData(data);
    } catch (e) { setHistoryData({ memberships: [], requests: [] }); }
  };

  const deductSession = async (userId: string) => {
    try {
      await api.post(`/api/admin/users/${userId}/deduct-session`, {});
      Alert.alert('Uspješno', 'Termin je oduzet');
      await load();
    } catch (e: any) { Alert.alert('Greška', e.message || 'Greška'); }
  };

  const freezeUser = async (userId: string) => {
    const start = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    try {
      await api.post(`/api/admin/users/${userId}/freeze`, { start_date: start, end_date: end });
      Alert.alert('Uspješno', 'Korisnik zamrznut na 7 dana');
      await load();
    } catch (e: any) { Alert.alert('Greška', e.message || 'Greška'); }
  };

  const addMembership = async () => {
    if (!memberModal || !selectedPkg) return;
    try {
      await api.post(`/api/admin/users/${memberModal.user_id}/add-membership`, { package_id: selectedPkg });
      Alert.alert('Uspješno', 'Članarina dodana');
      setMemberModal(null); setSelectedPkg('');
      await load();
    } catch (e: any) { Alert.alert('Greška', e.message || 'Greška'); }
  };

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={s.flex}>
      <ScrollView style={s.flex} contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>
        <Text style={s.sectionTitle}>Korisnici</Text>
        <View style={s.searchBox}>
          <Feather name="search" size={18} color={Colors.muted} />
          <TextInput style={s.searchInput} placeholder="Pretraži korisnike..." placeholderTextColor={Colors.muted}
            value={search} onChangeText={setSearch} />
        </View>

        {filtered.map((u: any) => {
          const isExpanded = expandedId === u.user_id;
          return (
            <View key={u.user_id}>
              <TouchableOpacity style={s.userCard} onPress={() => setExpandedId(isExpanded ? null : u.user_id)}
                testID={`user-${u.user_id}`}>
                <View style={s.userCardLeft}>
                  <View style={s.userNameRow}>
                    <Text style={s.userName}>{u.name}</Text>
                    <View style={[s.activeBadge, !u.aktivna_clanarina && u.status !== 'active' && s.inactiveBadge]}>
                      <Text style={s.activeBadgeText}>{u.status === 'active' ? 'Aktivan' : u.status}</Text>
                    </View>
                  </View>
                  <Text style={s.userSub}>{u.phone} | {u.email}</Text>
                </View>
                <View style={s.userCardRight}>
                  {u.naziv_paketa && u.naziv_paketa !== '-' ? (
                    <>
                      <Text style={s.userPkg}>{u.naziv_paketa}</Text>
                      <Text style={s.userSessions}>{u.preostali_termini || 0}/{u.ukupni_termini || 0}</Text>
                    </>
                  ) : <Text style={s.userSessions}>0/0</Text>}
                </View>
                <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.muted} />
              </TouchableOpacity>

              {isExpanded && (
                <View style={s.expandedContent}>
                  <View style={s.expandedStats}>
                    <View style={s.expandedStat}><Text style={s.expandedLabel}>Registracija</Text><Text style={s.expandedValue}>{(u.created_at || '').slice(0, 10)}</Text></View>
                    <View style={s.expandedStat}><Text style={s.expandedLabel}>Aktivacija</Text><Text style={s.expandedValue}>{u.datum_aktivacije || '-'}</Text></View>
                    <View style={s.expandedStat}><Text style={s.expandedLabel}>Ističe</Text><Text style={s.expandedValue}>{u.datum_isteka || '-'}</Text></View>
                    <View style={s.expandedStat}><Text style={s.expandedLabel}>Zakazani</Text><Text style={s.expandedValue}>{u.predstojeći_treninzi || 0} termina</Text></View>
                  </View>

                  {u.notes ? (
                    <View style={s.noteBox}><Text style={s.noteLabel}>BILJEŠKA</Text><Text style={s.noteText}>{u.notes}</Text></View>
                  ) : null}

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.actionRow}>
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#F97316' }]} onPress={() => deductSession(u.user_id)}>
                      <Feather name="minus-circle" size={14} color="#FFF" /><Text style={s.actionBtnText}>Oduzmi termin</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#3B82F6' }]} onPress={() => freezeUser(u.user_id)}>
                      <Feather name="pause-circle" size={14} color="#FFF" /><Text style={s.actionBtnText}>Zamrzni</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#10B981' }]} onPress={() => setMemberModal(u)}>
                      <Feather name="plus-circle" size={14} color="#FFF" /><Text style={s.actionBtnText}>Dodaj članarinu</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.actionBtnOutline} onPress={() => loadHistory(u)}>
                      <Feather name="clock" size={14} color={Colors.foreground} /><Text style={s.actionBtnOutlineText}>Historija</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.actionBtnOutline} onPress={() => { setNoteModal(u); setNoteText(u.notes || ''); }}>
                      <Feather name="file-text" size={14} color={Colors.foreground} /><Text style={s.actionBtnOutlineText}>Bilješka</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              )}
            </View>
          );
        })}
        <Text style={[s.emptyText, { marginTop: 8 }]}>Ukupno: {filtered.length} korisnika</Text>
      </ScrollView>

      {/* Note Modal */}
      <Modal visible={!!noteModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Bilješka za {noteModal?.name}</Text>
            <TextInput style={[s.modalInput, { minHeight: 100, textAlignVertical: 'top' }]} placeholder="Upišite bilješku..."
              placeholderTextColor={Colors.muted} value={noteText} onChangeText={setNoteText} multiline />
            <TouchableOpacity style={s.modalBtnConfirm} onPress={saveNote}>
              <Text style={s.modalBtnConfirmText}>Sačuvaj bilješku</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalBtnCancel} onPress={() => setNoteModal(null)}>
              <Text style={s.modalBtnCancelText}>Odustani</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* History Modal */}
      <Modal visible={!!historyModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Historija - {historyModal?.name}</Text>
              <TouchableOpacity onPress={() => { setHistoryModal(null); setHistoryData(null); }}>
                <Feather name="x" size={22} color={Colors.foreground} />
              </TouchableOpacity>
            </View>
            {historyData ? (
              <ScrollView style={{ maxHeight: 400 }}>
                <Text style={s.histSection}>ČLANARINE</Text>
                {(historyData.memberships || []).map((m: any, i: number) => (
                  <View key={i} style={s.histRow}>
                    <Text style={s.userName}>{m.name}</Text>
                    <Text style={s.userSub}>Cijena: {m.price} KM | Termini: {m.sessions}</Text>
                  </View>
                ))}
                <Text style={s.histSection}>ZAHTJEVI</Text>
                {(historyData.requests || []).map((r: any, i: number) => (
                  <View key={i} style={s.histRow}>
                    <View style={s.histReqRow}>
                      <Text style={s.userName}>{r.package_name} - {r.package_price} KM</Text>
                      <View style={[s.statusBadge, { backgroundColor: r.status === 'approved' ? '#05966920' : '#D9770620' }]}>
                        <Text style={[s.statusText, { color: r.status === 'approved' ? '#059669' : '#D97706' }]}>
                          {r.status === 'approved' ? 'Odobreno' : r.status}
                        </Text>
                      </View>
                    </View>
                    <Text style={s.userSub}>{(r.created_at || '').slice(0, 10)}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : <ActivityIndicator color={Colors.primary} />}
          </View>
        </View>
      </Modal>

      {/* Add Membership Modal */}
      <Modal visible={!!memberModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Dodaj članarinu</Text>
            <Text style={s.userSub}>Korisnik: {memberModal?.name}</Text>
            <View style={s.pkgList}>
              {packages.map((p: any) => (
                <TouchableOpacity key={p.id} style={[s.pkgOption, selectedPkg === p.id && s.pkgOptionActive]}
                  onPress={() => setSelectedPkg(p.id)}>
                  <Text style={[s.pkgOptionText, selectedPkg === p.id && s.pkgOptionTextActive]}>
                    {p.naziv || p.name} - {p.cijena || p.price} KM ({p.termini || p.sessions} termina)
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalBtnCancel} onPress={() => { setMemberModal(null); setSelectedPkg(''); }}>
                <Text style={s.modalBtnCancelText}>Odustani</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtnConfirm, !selectedPkg && { opacity: 0.5 }]} onPress={addMembership} disabled={!selectedPkg}>
                <Text style={s.modalBtnConfirmText}>Kreiraj članarinu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ============= STYLES =============
const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  topBar: { backgroundColor: Colors.cardBg, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: 16, paddingBottom: 12 },
  topTitle: { fontFamily: Fonts.heading, fontSize: 22, color: Colors.foreground, marginBottom: 12 },
  tabRow: { gap: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.secondary },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontFamily: Fonts.bodySemiBold, fontSize: 13, color: Colors.primary },
  tabTextActive: { color: Colors.white },
  sectionTitle: { fontFamily: Fonts.heading, fontSize: 20, color: Colors.foreground, marginBottom: 16, marginTop: 8 },
  emptyText: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.muted, textAlign: 'center', paddingVertical: 20 },
  // Stats
  statsRow: { gap: 10, paddingBottom: 16 },
  statCard: { width: 130, ...CardStyle, padding: 16, alignItems: 'flex-start' },
  statIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  statValue: { fontFamily: Fonts.heading, fontSize: 22, color: Colors.foreground, marginBottom: 2 },
  statLabel: { fontFamily: Fonts.body, fontSize: 11, color: Colors.muted },
  // Card
  card: { ...CardStyle, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontFamily: Fonts.heading, fontSize: 16, color: Colors.foreground },
  // Reminders
  reminderInput: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  reminderTextInput: { flex: 1, backgroundColor: Colors.background, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.foreground },
  addBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  reminderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  reminderText: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.foreground, flex: 1, marginRight: 12 },
  warningBtn: { padding: 8 },
  goldBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  goldBtnText: { fontFamily: Fonts.bodySemiBold, fontSize: 12, color: Colors.white },
  // Finance
  financeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  finBox: { flex: 1, backgroundColor: Colors.background, borderRadius: 12, padding: 12 },
  finLabel: { fontFamily: Fonts.body, fontSize: 10, color: Colors.muted, marginBottom: 4 },
  finValue: { fontFamily: Fonts.bodyBold, fontSize: 16, color: Colors.foreground },
  finPkgRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  finPkgName: { fontFamily: Fonts.bodyMedium, fontSize: Sizes.small, color: Colors.foreground },
  finPkgPrice: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.small, color: Colors.primary },
  // Schedule
  scheduleDay: { marginBottom: 20 },
  scheduleDateLabel: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.small, color: Colors.foreground, backgroundColor: Colors.secondary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 10, overflow: 'hidden' },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotCard: { width: '48%', backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 10 },
  slotHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  slotTime: { fontFamily: Fonts.bodyBold, fontSize: 16, color: Colors.foreground },
  slotInstructor: { fontFamily: Fonts.body, fontSize: 11, color: Colors.muted },
  slotSpots: { fontFamily: Fonts.bodySemiBold, fontSize: 12, color: '#059669', marginTop: 4 },
  // Bookings
  filterRow: { gap: 8, marginBottom: 16 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.secondary },
  filterBtnActive: { backgroundColor: Colors.primary },
  filterText: { fontFamily: Fonts.bodySemiBold, fontSize: 13, color: Colors.foreground },
  filterTextActive: { color: Colors.white },
  bookingCard: { ...CardStyle, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  bookingInfo: { flex: 1 },
  bookingDate: { fontFamily: Fonts.bodySemiBold, fontSize: 12, color: Colors.foreground },
  bookingTime: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.primary },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontFamily: Fonts.bodySemiBold, fontSize: 11 },
  cancelBtn: { padding: 6 },
  // Users
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: 12, paddingHorizontal: 12, gap: 8, marginBottom: 16 },
  searchInput: { flex: 1, fontFamily: Fonts.body, fontSize: Sizes.body, color: Colors.foreground, paddingVertical: 12 },
  userCard: { ...CardStyle, marginBottom: 8, flexDirection: 'row', alignItems: 'center', padding: 14 },
  userCardLeft: { flex: 1 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  userName: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.body, color: Colors.foreground },
  userSub: { fontFamily: Fonts.body, fontSize: Sizes.tiny, color: Colors.muted },
  userCardRight: { alignItems: 'flex-end', marginRight: 8 },
  userPkg: { fontFamily: Fonts.bodySemiBold, fontSize: 12, color: Colors.foreground },
  userSessions: { fontFamily: Fonts.body, fontSize: 11, color: Colors.muted },
  activeBadge: { backgroundColor: '#05966920', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  inactiveBadge: { backgroundColor: '#88888820' },
  activeBadgeText: { fontFamily: Fonts.bodySemiBold, fontSize: 10, color: '#059669' },
  userRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  userDate: { fontFamily: Fonts.body, fontSize: Sizes.tiny, color: Colors.muted },
  // Expanded user
  expandedContent: { backgroundColor: Colors.secondary, borderRadius: 16, padding: 14, marginBottom: 8, marginTop: -4 },
  expandedStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  expandedStat: { flex: 1, minWidth: '45%', backgroundColor: Colors.cardBg, borderRadius: 10, padding: 10 },
  expandedLabel: { fontFamily: Fonts.body, fontSize: 10, color: Colors.muted, marginBottom: 2 },
  expandedValue: { fontFamily: Fonts.bodySemiBold, fontSize: 13, color: Colors.foreground },
  noteBox: { backgroundColor: '#A68B5B20', borderRadius: 10, padding: 10, marginBottom: 12 },
  noteLabel: { fontFamily: Fonts.bodySemiBold, fontSize: 10, color: Colors.primary, marginBottom: 4 },
  noteText: { fontFamily: Fonts.body, fontSize: Sizes.small, color: Colors.foreground },
  actionRow: { gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  actionBtnText: { fontFamily: Fonts.bodySemiBold, fontSize: 11, color: '#FFF' },
  actionBtnOutline: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.border },
  actionBtnOutlineText: { fontFamily: Fonts.bodySemiBold, fontSize: 11, color: Colors.foreground },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: Colors.cardBg, borderRadius: 24, padding: 24, width: '100%', maxWidth: 400 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: Fonts.heading, fontSize: 18, color: Colors.foreground, marginBottom: 12 },
  modalInput: { backgroundColor: Colors.background, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontFamily: Fonts.body, fontSize: Sizes.body, color: Colors.foreground, marginBottom: 12, borderWidth: 1, borderColor: Colors.inputBorder },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalBtnCancel: { flex: 1, height: 44, borderRadius: 9999, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  modalBtnCancelText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.small, color: Colors.foreground },
  modalBtnConfirm: { flex: 1, height: 44, borderRadius: 9999, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  modalBtnConfirmText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.small, color: Colors.white },
  // History
  histSection: { fontFamily: Fonts.bodySemiBold, fontSize: 12, color: Colors.muted, marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  histRow: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  histReqRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  // Packages
  pkgList: { gap: 6, marginVertical: 12 },
  pkgOption: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.inputBorder, backgroundColor: Colors.background },
  pkgOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  pkgOptionText: { fontFamily: Fonts.bodyMedium, fontSize: Sizes.small, color: Colors.foreground },
  pkgOptionTextActive: { color: Colors.primary, fontFamily: Fonts.bodySemiBold },
  // Warning row
  warningRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
});
