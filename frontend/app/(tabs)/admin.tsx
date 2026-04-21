import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  RefreshControl, ActivityIndicator, TextInput, Modal, Alert, FlatList,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Sizes, CardStyle, formatDD } from '../../src/theme';
import { api } from '../../src/api';
import { useAuth } from '../../src/context/AuthContext';

type Section = 'dashboard' | 'finance' | 'schedule' | 'bookings' | 'users';

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
    { key: 'finance', label: 'Finansije', icon: 'dollar-sign' },
    { key: 'schedule', label: 'Raspored', icon: 'calendar' },
    { key: 'bookings', label: 'Rezervacije', icon: 'book-open' },
    { key: 'users', label: 'Korisnici', icon: 'users' },
  ];

  return (
    <View style={s.flex}>
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

      {section === 'dashboard' && <DashboardSection onNavigate={setSection} />}
      {section === 'finance' && <FinanceSection />}
      {section === 'schedule' && <ScheduleSection />}
      {section === 'bookings' && <BookingsSection />}
      {section === 'users' && <UsersSection />}
    </View>
  );
}

// ============= DASHBOARD =============
function DashboardSection({ onNavigate }: { onNavigate: (s: Section) => void }) {
  const [stats, setStats] = useState<any>(null);
  const [reminders, setReminders] = useState<any[]>([]);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [todayBookings, setTodayBookings] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newReminder, setNewReminder] = useState('');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [subScreen, setSubScreen] = useState<'main' | 'active_members' | 'today_trainings'>('main');

  const load = useCallback(async () => {
    try {
      const [st, rem, usr, reqs, bk] = await Promise.allSettled([
        api.get('/api/admin/stats'),
        api.get('/api/admin/reminders'),
        api.get('/api/admin/users'),
        api.get('/api/admin/package-requests'),
        api.get('/api/admin/bookings'),
      ]);
      if (st.status === 'fulfilled') setStats(st.value);
      if (rem.status === 'fulfilled') setReminders(Array.isArray(rem.value) ? rem.value : []);
      if (usr.status === 'fulfilled') {
        const list = Array.isArray(usr.value) ? usr.value : [];
        setAllUsers(list);
        setRecentUsers(list.sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 5));
      }
      if (reqs.status === 'fulfilled') {
        const all = Array.isArray(reqs.value) ? reqs.value : [];
        setPendingRequests(all.filter((r: any) => r.status === 'pending'));
      }
      if (bk.status === 'fulfilled') {
        const all = Array.isArray(bk.value) ? bk.value : [];
        const today = new Date().toISOString().slice(0, 10);
        const todayBk = all.filter((b: any) => (b.datum || b.date) === today && (b.tip || b.status || '') !== 'otkazani')
          .sort((a: any, b: any) => (a.vrijeme || a.time || '').localeCompare(b.vrijeme || b.time || ''));
        setTodayBookings(todayBk);
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

  const activeMembers = allUsers.filter((u: any) => u.aktivna_clanarina);

  const handleCardPress = (label: string) => {
    if (label === 'Korisnici') onNavigate('users');
    else if (label === 'Aktivne članarine') setSubScreen('active_members');
    else if (label === 'Današnji treninzi') setSubScreen('today_trainings');
    else if (label.startsWith('Prihod')) onNavigate('finance');
    // 'Zahtjevi na čekanju' — no navigation
  };

  // === SUB-SCREEN: Aktivne članarine ===
  if (subScreen === 'active_members') {
    const inactiveUsers = allUsers.filter((u: any) => !u.aktivna_clanarina);
    return (
      <ScrollView style={s.flex} contentContainerStyle={s.content}>
        <TouchableOpacity style={s.subScreenBack} onPress={() => setSubScreen('main')}>
          <Feather name="arrow-left" size={20} color={Colors.foreground} />
          <Text style={s.subScreenBackText}>Kontrolna tabla</Text>
        </TouchableOpacity>
        <Text style={s.sectionTitle}>Aktivne članarine ({activeMembers.length})</Text>
        {activeMembers.length === 0 ? <Text style={s.emptyText}>Nema aktivnih članarina</Text> :
          activeMembers.map((u: any) => (
            <View key={u.user_id} style={s.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={s.userName}>{u.name}</Text>
                <View style={[s.activeBadge]}><Text style={s.activeBadgeText}>Aktivna</Text></View>
              </View>
              <Text style={s.userSub}>{u.naziv_paketa || '-'}</Text>
              <Text style={[s.userSub, { color: Colors.primary, fontFamily: Fonts.bodySemiBold }]}>
                Preostalo: {u.preostali_termini || 0}/{u.ukupni_termini || 0} termina
              </Text>
              {u.datum_isteka && <Text style={s.userSub}>Ističe: {formatDD(u.datum_isteka)}</Text>}
            </View>
          ))}

        <Text style={[s.sectionTitle, { marginTop: 24 }]}>Neaktivni korisnici ({inactiveUsers.length})</Text>
        {inactiveUsers.length === 0 ? <Text style={s.emptyText}>Nema neaktivnih korisnika</Text> :
          inactiveUsers.map((u: any) => (
            <View key={u.user_id} style={[s.card, { opacity: 0.7 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={s.userName}>{u.name}</Text>
                <View style={[s.activeBadge, s.inactiveBadge]}><Text style={[s.activeBadgeText, { color: Colors.muted }]}>Neaktivan</Text></View>
              </View>
              <Text style={s.userSub}>{u.phone}</Text>
              {u.last_activity && <Text style={s.userSub}>Zadnja aktivnost: {formatDD(u.last_activity)}</Text>}
              {u.naziv_paketa && u.naziv_paketa !== '-' && <Text style={s.userSub}>Prethodni paket: {u.naziv_paketa}</Text>}
              {u.datum_isteka && <Text style={s.userSub}>Istekao: {formatDD(u.datum_isteka)}</Text>}
            </View>
          ))}
      </ScrollView>
    );
  }

  // === SUB-SCREEN: Današnji treninzi ===
  if (subScreen === 'today_trainings') {
    return (
      <ScrollView style={s.flex} contentContainerStyle={s.content}>
        <TouchableOpacity style={s.subScreenBack} onPress={() => setSubScreen('main')}>
          <Feather name="arrow-left" size={20} color={Colors.foreground} />
          <Text style={s.subScreenBackText}>Kontrolna tabla</Text>
        </TouchableOpacity>
        <Text style={s.sectionTitle}>Današnji treninzi ({todayBookings.length})</Text>
        {todayBookings.length === 0 ? <Text style={s.emptyText}>Nema zakazanih treninga za danas</Text> :
          todayBookings.map((b: any) => (
            <View key={b.id || b._id} style={s.card}>
              <View style={s.todayRow}>
                <View style={s.todayTime}><Text style={s.todayTimeText}>{b.vrijeme || b.time}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.userName}>{b.korisnik_ime || b.user_name || b.korisnik?.name || b.name || 'Korisnik'}</Text>
                  <Text style={s.userSub}>{b.user_email || b.user_phone || ''}</Text>
                </View>
              </View>
            </View>
          ))}
      </ScrollView>
    );
  }

  // === MAIN DASHBOARD ===

  const approveRequest = async (id: string) => {
    try {
      await api.post(`/api/admin/package-requests/${id}/approve`);
      Alert.alert('Uspješno', 'Paket odobren');
      await load();
    } catch (e: any) { Alert.alert('Greška', e.message || 'Greška pri odobravanju'); }
  };

  const rejectRequest = async (id: string) => {
    Alert.alert('Odbij zahtjev', 'Da li ste sigurni?', [
      { text: 'Ne', style: 'cancel' },
      { text: 'Da, odbij', style: 'destructive', onPress: async () => {
        try { await api.post(`/api/admin/package-requests/${id}/reject`); await load(); }
        catch (e: any) { Alert.alert('Greška', e.message || 'Greška'); }
      }},
    ]);
  };

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>
      <Text style={s.sectionTitle}>Kontrolna tabla</Text>

      {/* Stats Cards — clickable */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.statsRow}>
        {[
          { label: 'Korisnici', value: allUsers.length || stats?.total_users || 0, icon: 'users', color: '#7C3AED' },
          { label: 'Aktivne članarine', value: stats?.active_memberships || 0, icon: 'credit-card', color: '#059669' },
          { label: 'Današnji treninzi', value: stats?.today_trainings || 0, icon: 'calendar', color: Colors.primary },
          { label: 'Zahtjevi na čekanju', value: stats?.pending_requests || 0, icon: 'clock', color: '#2563EB' },
          { label: 'Prihod (mjesec)', value: `${stats?.monthly_income || 0} KM`, icon: 'dollar-sign', color: '#D97706' },
        ].map((c, i) => (
          <TouchableOpacity key={i} style={s.statCard} onPress={() => handleCardPress(c.label)}
            activeOpacity={c.label === 'Zahtjevi na čekanju' ? 1 : 0.7} testID={`stat-card-${i}`}>
            <View style={[s.statIcon, { backgroundColor: c.color + '20' }]}>
              <Feather name={c.icon as any} size={18} color={c.color} />
            </View>
            <Text style={s.statValue}>{c.value}</Text>
            <Text style={s.statLabel}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Pending Package Requests */}
      {pendingRequests.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Zahtjevi na čekanju ({pendingRequests.length})</Text>
          {pendingRequests.map((r: any) => (
            <View key={r.id} style={s.requestRow} testID={`pending-request-${r.id}`}>
              <View style={s.requestInfo}>
                <Text style={s.userName}>{r.user_name}</Text>
                <Text style={s.userSub}>{r.package_name} — {r.package_price} KM</Text>
                <Text style={s.userSub}>{r.package_sessions} termina • {formatDD(r.created_at)}</Text>
              </View>
              <View style={s.requestActions}>
                <TouchableOpacity testID={`approve-req-${r.id}`} style={s.approveBtn} onPress={() => approveRequest(r.id)}>
                  <Feather name="check" size={16} color={Colors.white} />
                </TouchableOpacity>
                <TouchableOpacity testID={`reject-req-${r.id}`} style={s.rejectBtn} onPress={() => rejectRequest(r.id)}>
                  <Feather name="x" size={16} color={Colors.white} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Reminders */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Podsjetnici ({reminders.length})</Text>
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

      {/* Današnji treninzi */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Današnji treninzi ({todayBookings.length})</Text>
        {todayBookings.length === 0 ? (
          <Text style={s.emptyText}>Nema zakazanih treninga za danas</Text>
        ) : todayBookings.map((b: any) => {
          const uid = b.user_id || '';
          const usr = allUsers.find((u: any) => u.user_id === uid);
          const isExp = expandedUserId === uid;
          return (
            <View key={b.id || b._id}>
              <TouchableOpacity style={s.todayRow} onPress={() => setExpandedUserId(isExp ? null : uid)}>
                <View style={s.todayTime}><Text style={s.todayTimeText}>{b.vrijeme || b.time}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.userName}>{b.korisnik_ime || b.user_name || b.korisnik?.name || b.name || 'Korisnik'}</Text>
                  <Text style={s.userSub}>{b.user_email || ''}</Text>
                </View>
                <Feather name={isExp ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.muted} />
              </TouchableOpacity>
              {isExp && usr && (
                <View style={s.expandedContent}>
                  <View style={s.expandedStats}>
                    <View style={s.expandedStat}><Text style={s.expandedLabel}>Registracija</Text><Text style={s.expandedValue}>{formatDD(usr.created_at)}</Text></View>
                    <View style={s.expandedStat}><Text style={s.expandedLabel}>Paket</Text><Text style={s.expandedValue}>{usr.naziv_paketa || '-'}</Text></View>
                    <View style={s.expandedStat}><Text style={s.expandedLabel}>Termini</Text><Text style={s.expandedValue}>{usr.preostali_termini || 0}/{usr.ukupni_termini || 0}</Text></View>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ============= FINANCE & ANALYTICS =============
const MONTH_NAMES: Record<string, string> = {
  '01': 'Januar', '02': 'Februar', '03': 'Mart', '04': 'April', '05': 'Maj', '06': 'Juni',
  '07': 'Juli', '08': 'August', '09': 'Septembar', '10': 'Oktobar', '11': 'Novembar', '12': 'Decembar',
};

function FinanceSection() {
  const [finance, setFinance] = useState<any>(null);
  const [slotAnalytics, setSlotAnalytics] = useState<any>(null);
  const [clientAnalytics, setClientAnalytics] = useState<any>(null);
  const [warnings, setWarnings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<any>(null);
  const [showManual, setShowManual] = useState(false);
  const [showWarnings, setShowWarnings] = useState(false);
  const [manualAmt, setManualAmt] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualCat, setManualCat] = useState('Ostalo');
  const [subSection, setSubSection] = useState<'finance' | 'slots' | 'clients'>('finance');

  const load = useCallback(async () => {
    try {
      const [f, sa, ca, w] = await Promise.allSettled([
        api.get('/api/admin/financial'),
        api.get('/api/admin/analytics/slots'),
        api.get('/api/admin/analytics/clients'),
        api.get('/api/admin/warnings'),
      ]);
      if (f.status === 'fulfilled') setFinance(f.value);
      if (sa.status === 'fulfilled') setSlotAnalytics(sa.value);
      if (ca.status === 'fulfilled') setClientAnalytics(ca.value);
      if (w.status === 'fulfilled') setWarnings(Array.isArray(w.value) ? w.value : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const addManual = async () => {
    const amt = parseFloat(manualAmt);
    if (isNaN(amt) || amt <= 0) { Alert.alert('Greška', 'Unesite iznos'); return; }
    try {
      await api.post('/api/admin/manual-income', { iznos: amt, opis: manualDesc, kategorija: manualCat });
      setShowManual(false); setManualAmt(''); setManualDesc('');
      await load();
    } catch (e: any) { Alert.alert('Greška', e.message || 'Greška'); }
  };

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  const months = finance?.mjesecni_prihod || [];

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>

      {/* Sub-section tabs */}
      <View style={s.subTabs}>
        {[
          { key: 'finance', label: 'Finansije', icon: 'dollar-sign' },
          { key: 'slots', label: 'Statistika termina', icon: 'bar-chart-2' },
          { key: 'clients', label: 'Klijenti', icon: 'users' },
        ].map((t: any) => (
          <TouchableOpacity key={t.key} style={[s.subTab, subSection === t.key && s.subTabActive]}
            onPress={() => setSubSection(t.key)}>
            <Feather name={t.icon} size={14} color={subSection === t.key ? Colors.white : Colors.primary} />
            <Text style={[s.subTabText, subSection === t.key && s.subTabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[s.subTab, { backgroundColor: warnings.length > 0 ? '#DC354520' : Colors.secondary }]}
          onPress={() => setShowWarnings(true)}>
          <Feather name="alert-triangle" size={14} color={warnings.length > 0 ? Colors.danger : Colors.muted} />
          {warnings.length > 0 && <View style={s.warningDot}><Text style={s.warningDotText}>{warnings.length}</Text></View>}
        </TouchableOpacity>
      </View>

      {/* === FINANSIJE === */}
      {subSection === 'finance' && (
        <>
          <View style={s.cardHeader}>
            <Text style={s.sectionTitle}>Finansije</Text>
            <TouchableOpacity style={s.goldBtn} onPress={() => setShowManual(true)}>
              <Feather name="plus" size={14} color={Colors.white} /><Text style={s.goldBtnText}>Ručni prihod</Text>
            </TouchableOpacity>
          </View>
          {months.map((m: any, i: number) => {
            if (!m || !m.month) return null;
            const [yr, mn] = m.month.split('-');
            const prevMonth = months[i + 1];
            const change = prevMonth ? ((m.revenue - prevMonth.revenue) / (prevMonth.revenue || 1) * 100) : 0;
            const manualTotal = m.manual_revenue || 0;
            const pkgTotal = m.pkg_revenue || 0;
            const isSelected = selectedMonth?.month === m.month;

            return (
              <TouchableOpacity key={m.month} style={s.card} onPress={() => setSelectedMonth(isSelected ? null : m)}
                testID={`month-card-${m.month}`}>
                <View style={s.monthHeader}>
                  <View>
                    <Text style={s.monthName}>{MONTH_NAMES[mn] || mn} {yr}</Text>
                    <Text style={s.monthTotal}>{m.revenue} KM</Text>
                  </View>
                  {prevMonth && (
                    <View style={[s.changeBadge, { backgroundColor: change >= 0 ? '#05966920' : '#DC354520' }]}>
                      <Feather name={change >= 0 ? 'trending-up' : 'trending-down'} size={12}
                        color={change >= 0 ? '#059669' : Colors.danger} />
                      <Text style={[s.changeText, { color: change >= 0 ? '#059669' : Colors.danger }]}>
                        {change >= 0 ? '+' : ''}{change.toFixed(0)}%
                      </Text>
                    </View>
                  )}
                  <Feather name={isSelected ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.muted} />
                </View>

                {isSelected && (
                  <View style={s.monthDetail}>
                    <View style={s.financeRow}>
                      <View style={s.finBox}><Text style={s.finLabel}>Paketi</Text><Text style={s.finValue}>{pkgTotal} KM</Text></View>
                      <View style={s.finBox}><Text style={s.finLabel}>Ručno</Text><Text style={s.finValue}>{manualTotal} KM</Text></View>
                    </View>
                    <View style={s.detailRow}>
                    <Text style={s.userName}>Paketi</Text>
                    <Text style={s.finPkgPrice}>{m.pkg_revenue || 0} KM</Text>
                    </View>
                    ))}
                    {(m.manual_revenue || 0) > 0 && (
                    <View style={s.detailRow}>
                    <Text style={s.userName}>Ručni prihodi</Text>
                    <Text style={s.finPkgPrice}>{m.manual_revenue} KM</Text>
                    </View>
                      )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
          {months.length === 0 && <Text style={s.emptyText}>Nema finansijskih podataka</Text>}
        </>
      )}

      {/* === STATISTIKA TERMINA === */}
        {subSection === 'slots' && slotAnalytics && (
          <>
            <Text style={s.sectionTitle}>Statistika termina</Text>
            <View style={s.statsRow}>
              <View style={s.miniStat}><Text style={s.miniStatValue}>{slotAnalytics.average_occupancy_percent}%</Text><Text style={s.miniStatLabel}>Prosječna popunjenost (od početka)</Text></View>
              <View style={s.miniStat}><Text style={s.miniStatValue}>{slotAnalytics.total_bookings}</Text><Text style={s.miniStatLabel}>Ukupno rezervacija</Text></View>
              <View style={s.miniStat}><Text style={s.miniStatValue}>{slotAnalytics.cancellations || 0}</Text><Text style={s.miniStatLabel}>Otkazivanja</Text></View>
            </View>
            <View style={s.card}>
              <Text style={s.cardTitle}>Najpopularniji dani (po broju rezervacija)</Text>
              {(slotAnalytics.popular_days || []).map((d: any) => {
                const maxCount = Math.max(...(slotAnalytics.popular_days || []).map((x: any) => x.rezervacija || 0), 1);
                const pct = Math.max((d.rezervacija / maxCount) * 100, 2);
                return (
                  <View key={d.dan} style={s.barRow}>
                    <Text style={s.barLabel}>{d.dan}</Text>
                    <View style={s.barBg}><View style={[s.barFill, { width: `${pct}%` }]} /></View>
                    <Text style={s.barValue}>{d.rezervacija}</Text>
                  </View>
                );
              })}
            </View>
            <View style={s.card}>
              <Text style={s.cardTitle}>Najpopularniji termini (po broju rezervacija)</Text>
              {(slotAnalytics.popular_times || []).map((t: any) => {
                const maxCount = Math.max(...(slotAnalytics.popular_times || []).map((x: any) => x.rezervacija || 0), 1);
                const pct = Math.max((t.rezervacija / maxCount) * 100, 2);
                return (
                  <View key={t.vrijeme} style={s.barRow}>
                    <Text style={s.barLabel}>{t.vrijeme}</Text>
                    <View style={s.barBg}><View style={[s.barFill, { width: `${pct}%` }]} /></View>
                    <Text style={s.barValue}>{t.rezervacija}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
      
      {/* === KLIJENTI STATISTIKA === */}
      {subSection === 'clients' && clientAnalytics && (
        <>
          <Text style={s.sectionTitle}>Klijenti statistika</Text>
          <View style={s.statsRow}>
            <View style={s.miniStat}><Text style={[s.miniStatValue, { color: '#059669' }]}>{clientAnalytics.active_count}</Text><Text style={s.miniStatLabel}>Aktivni</Text></View>
            <View style={s.miniStat}><Text style={[s.miniStatValue, { color: Colors.danger }]}>{clientAnalytics.inactive_count}</Text><Text style={s.miniStatLabel}>Neaktivni</Text></View>
            <View style={s.miniStat}><Text style={s.miniStatValue}>{(clientAnalytics.active_count || 0) + (clientAnalytics.inactive_count || 0)}</Text><Text style={s.miniStatLabel}>Ukupno</Text></View>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Novi klijenti</Text>
            <View style={s.compareRow}>
              <View style={s.compareBox}>
                <Text style={s.compareValue}>{clientAnalytics.new_this_month}</Text>
                <Text style={s.compareLabel}>Ovaj mjesec</Text>
              </View>
              <Feather name="arrow-right" size={16} color={Colors.muted} />
              <View style={s.compareBox}>
                <Text style={s.compareValue}>{clientAnalytics.new_last_month}</Text>
                <Text style={s.compareLabel}>Prošli mjesec</Text>
              </View>
            </View>
          </View>

          {(clientAnalytics.package_retention || []).length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Retencija po paketu</Text>
              {clientAnalytics.package_retention.map((r: any) => (
                <View key={r.package} style={s.detailRow}>
                  <Text style={s.userName}>{r.package}</Text>
                  <Text style={s.userSub}>{r.renewed}/{r.total} obnovilo</Text>
                  <Text style={[s.finPkgPrice, { color: r.rate > 50 ? '#059669' : Colors.primary }]}>{r.rate}%</Text>
                </View>
              ))}
            </View>
          )}

          {(clientAnalytics.inactive_30_days || []).length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Neaktivni 30+ dana</Text>
              {clientAnalytics.inactive_30_days.map((u: any, i: number) => (
                <View key={i} style={s.detailRow}>
                  <Text style={s.userName}>{u.name}</Text>
                  <Text style={s.userSub}>{u.phone}</Text>
                  <Text style={[s.finPkgPrice, { color: Colors.danger }]}>{u.days} dana</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}

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
                    <Feather name={w.type === 'no_sessions' ? 'alert-circle' : w.type === 'expiring' ? 'clock' : 'user-x'} size={16}
                      color={w.severity === 'high' ? Colors.danger : w.severity === 'medium' ? '#D97706' : Colors.muted} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.userName}>{w.name}</Text>
                      <Text style={[s.userSub, { color: w.severity === 'high' ? Colors.danger : Colors.muted }]}>{w.message}</Text>
                    </View>
                    <Text style={s.userSub}>{w.phone}</Text>
                  </View>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Manual Income Modal */}
      <Modal visible={showManual} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Ručni prihod</Text>
            <TextInput style={s.modalInput} placeholder="Iznos (KM)" placeholderTextColor={Colors.muted}
              value={manualAmt} onChangeText={setManualAmt} keyboardType="decimal-pad" />
            <TextInput style={s.modalInput} placeholder="Opis (npr. Prodaja opreme)" placeholderTextColor={Colors.muted}
              value={manualDesc} onChangeText={setManualDesc} />
            <View style={s.catRow}>
              {['Paketi', 'Oprema', 'Ostalo'].map(c => (
                <TouchableOpacity key={c} style={[s.catBtn, manualCat === c && s.catBtnActive]} onPress={() => setManualCat(c)}>
                  <Text style={[s.catBtnText, manualCat === c && s.catBtnTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalBtnCancel} onPress={() => setShowManual(false)}>
                <Text style={s.modalBtnCancelText}>Odustani</Text></TouchableOpacity>
              <TouchableOpacity style={s.modalBtnConfirm} onPress={addManual}>
                <Text style={s.modalBtnConfirmText}>Sačuvaj</Text></TouchableOpacity>
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
      const res = await api.post('/api/admin/schedule/generate-week', { days: 14 });
      Alert.alert('Generisano', res.message || 'Termini generisani');
      await load();
    } catch (e: any) { Alert.alert('Greška', e.message || 'Greška'); }
  };

  const deleteSlot = async (id: string) => {
    Alert.alert('Obriši termin', 'Da li ste sigurni?', [
      { text: 'Ne', style: 'cancel' },
      { text: 'Da, obriši', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/api/admin/schedule/slots/${id}`);
          await load();
        } catch (e: any) { Alert.alert('Greška', e.message || 'Greška'); }
      }},
    ]);
  };

  const deleteDay = async (datum: string) => {
    Alert.alert('Obriši cijeli dan', `Obrisati sve termine za ${datum}?`, [
      { text: 'Ne', style: 'cancel' },
      { text: 'Da, obriši dan', style: 'destructive', onPress: async () => {
        try {
          await api.post('/api/admin/schedule/delete-day', { datum });
          await load();
        } catch (e: any) { Alert.alert('Greška', e.message || 'Greška'); }
      }},
    ]);
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
          <View style={s.scheduleDayHeader}>
            <Text style={s.scheduleDateLabel}>{date}</Text>
            <TouchableOpacity testID={`delete-day-${date}`} style={s.deleteDayBtn} onPress={() => deleteDay(date)}>
              <Feather name="trash-2" size={12} color={Colors.danger} />
              <Text style={s.deleteDayText}>Obriši dan</Text>
            </TouchableOpacity>
          </View>
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

  // Auto-classify bookings by time — past → Završeni, cancelled → Otkazani
  const now = new Date();
  const classifiedBookings = bookings.map((b: any) => {
    const rawStatus = (b.status || b.tip || '').toLowerCase();
    if (rawStatus.includes('otkazan') || rawStatus === 'cancelled') return { ...b, _status: 'cancelled' };
    const dt = new Date(`${b.datum || b.date}T${b.vrijeme || b.time || '23:59'}`);
    if (dt < now) return { ...b, _status: 'completed' };
    return { ...b, _status: 'upcoming' };
  });

  const filtered = classifiedBookings.filter((b: any) => {
    if (filter === 'all') return true;
    return b._status === filter;
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
          const st = b._status || 'upcoming';
          const color = statusColors[st] || Colors.muted;
          const label = st === 'upcoming' ? 'Predstojeći' : st === 'completed' ? 'Završeni' : st === 'cancelled' ? 'Otkazani' : st;
          return (
            <View key={b.id || b._id} style={s.bookingCard}>
              <View style={s.bookingInfo}>
                <Text style={s.userName}>{b.korisnik_ime || b.user_name || b.korisnik?.name || b.name || 'Korisnik'}</Text>
                <Text style={s.userSub}>{b.user_email || b.email || ''}</Text>
              </View>
              <Text style={s.bookingDate}>{formatDD(b.datum || b.date)}</Text>
              <Text style={s.bookingTime}>{b.vrijeme || b.time}</Text>
              <View style={[s.statusBadge, { backgroundColor: color + '20' }]}>
                <Text style={[s.statusText, { color }]}>{label}</Text>
              </View>
              {st === 'upcoming' && (
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
  const [memberStartDate, setMemberStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [freezeModal, setFreezeModal] = useState<any>(null);
  const [freezeFrom, setFreezeFrom] = useState('');
  const [freezeTo, setFreezeTo] = useState('');
  const [freezeReason, setFreezeReason] = useState('');

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
    Alert.alert('Oduzmi termin', 'Da li ste sigurni da želite oduzeti termin?', [
      { text: 'Ne', style: 'cancel' },
      { text: 'Da, oduzmi', style: 'destructive', onPress: async () => {
        try {
          await api.post(`/api/admin/users/${userId}/deduct-session`, {});
          Alert.alert('Uspješno', 'Termin je oduzet');
          await load();
        } catch (e: any) { Alert.alert('Greška', e.message || 'Greška'); }
      }},
    ]);
  };

  const freezeUser = async () => {
    if (!freezeModal || !freezeFrom || !freezeTo) {
      Alert.alert('Greška', 'Unesite datume zamrzavanja');
      return;
    }
    try {
      await api.post(`/api/admin/users/${freezeModal.user_id}/freeze`, {
        start_date: freezeFrom, end_date: freezeTo, reason: freezeReason });
      Alert.alert('Uspješno', `Korisnik zamrznut od ${freezeFrom} do ${freezeTo}`);
      setFreezeModal(null); setFreezeFrom(''); setFreezeTo(''); setFreezeReason('');
      await load();
    } catch (e: any) { Alert.alert('Greška', e.message || 'Greška'); }
  };

  const unfreezeUser = async (userId: string) => {
    try {
      await api.post(`/api/admin/users/${userId}/unfreeze`, {});
      Alert.alert('Uspješno', 'Korisnik odmrznut');
      await load();
    } catch (e: any) { Alert.alert('Greška', e.message || 'Greška'); }
  };

  const addMembership = async () => {
    if (!memberModal || !selectedPkg) return;
    try {
      const result = await api.post(`/api/admin/users/${memberModal.user_id}/add-membership`, {
        package_id: selectedPkg,
        start_date: memberStartDate,
      });
      Alert.alert('Uspješno', result.message || 'Članarina dodana');
      setMemberModal(null); setSelectedPkg(''); setMemberStartDate(new Date().toISOString().slice(0, 10));
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
                    <View style={s.expandedStat}><Text style={s.expandedLabel}>Registracija</Text><Text style={s.expandedValue}>{formatDD(u.created_at)}</Text></View>
                    <View style={s.expandedStat}><Text style={s.expandedLabel}>Aktivacija</Text><Text style={s.expandedValue}>{formatDD(u.datum_aktivacije)}</Text></View>
                    <View style={s.expandedStat}><Text style={s.expandedLabel}>Ističe</Text><Text style={s.expandedValue}>{formatDD(u.datum_isteka)}</Text></View>
                    <View style={s.expandedStat}><Text style={s.expandedLabel}>Zakazani</Text><Text style={s.expandedValue}>{u.predstojeći_treninzi || 0} termina</Text></View>
                  </View>

                  {u.notes ? (
                    <View style={s.noteBox}><Text style={s.noteLabel}>BILJEŠKA</Text><Text style={s.noteText}>{u.notes}</Text></View>
                  ) : null}

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.actionRow}>
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#F97316' }]} onPress={() => deductSession(u.user_id)}>
                      <Feather name="minus-circle" size={14} color="#FFF" /><Text style={s.actionBtnText}>Oduzmi termin</Text>
                    </TouchableOpacity>
                    {(u.is_frozen || u.status === 'frozen') ? (
                      <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#059669' }]} onPress={() => unfreezeUser(u.user_id)}>
                        <Feather name="sun" size={14} color="#FFF" /><Text style={s.actionBtnText}>Odmrzni</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#3B82F6' }]}
                        onPress={() => { setFreezeModal(u); setFreezeFrom(new Date().toISOString().slice(0,10)); setFreezeTo(new Date(Date.now()+7*86400000).toISOString().slice(0,10)); }}>
                        <Feather name="pause-circle" size={14} color="#FFF" /><Text style={s.actionBtnText}>Zamrzni</Text>
                      </TouchableOpacity>
                    )}
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
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Bilješka za {noteModal?.name}</Text>
              <TouchableOpacity onPress={() => setNoteModal(null)}>
                <Feather name="x" size={22} color={Colors.foreground} />
              </TouchableOpacity>
            </View>
            <TextInput style={[s.modalInput, { minHeight: 120, textAlignVertical: 'top' }]} placeholder="Upišite bilješku..."
              placeholderTextColor={Colors.muted} value={noteText} onChangeText={setNoteText} multiline />
            <TouchableOpacity testID="save-note-btn" style={s.noteModalSaveBtn} onPress={saveNote}>
              <Text style={s.noteModalSaveBtnText}>Sačuvaj bilješku</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ paddingVertical: 12, alignItems: 'center' }} onPress={() => setNoteModal(null)}>
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
                    <Text style={s.userSub}>{formatDD(r.created_at)}</Text>
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
            <Text style={[s.expandedLabel, { marginTop: 12 }]}>Datum početka (YYYY-MM-DD)</Text>
            <TextInput style={s.modalInput} placeholder="2026-04-13" placeholderTextColor={Colors.muted}
              value={memberStartDate} onChangeText={setMemberStartDate} />
            <Text style={s.expandedLabel}>Odaberi paket</Text>
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
              <TouchableOpacity style={s.modalBtnCancel} onPress={() => { setMemberModal(null); setSelectedPkg(''); setMemberStartDate(new Date().toISOString().slice(0, 10)); }}>
                <Text style={s.modalBtnCancelText}>Odustani</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtnConfirm, !selectedPkg && { opacity: 0.5 }]} onPress={addMembership} disabled={!selectedPkg}>
                <Text style={s.modalBtnConfirmText}>Kreiraj članarinu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Freeze Modal */}
      <Modal visible={!!freezeModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Zamrzni članarinu</Text>
              <TouchableOpacity onPress={() => setFreezeModal(null)}><Feather name="x" size={22} color={Colors.foreground} /></TouchableOpacity>
            </View>
            <Text style={s.userSub}>Korisnik: {freezeModal?.name}</Text>
            <Text style={[s.expandedLabel, { marginTop: 16 }]}>Od (YYYY-MM-DD)</Text>
            <TextInput style={s.modalInput} placeholder="2026-04-12" placeholderTextColor={Colors.muted}
              value={freezeFrom} onChangeText={setFreezeFrom} />
            <Text style={s.expandedLabel}>Do (YYYY-MM-DD)</Text>
            <TextInput style={s.modalInput} placeholder="2026-04-19" placeholderTextColor={Colors.muted}
              value={freezeTo} onChangeText={setFreezeTo} />
            <Text style={s.expandedLabel}>Razlog</Text>
            <TextInput style={s.modalInput} placeholder="Razlog zamrzavanja..." placeholderTextColor={Colors.muted}
              value={freezeReason} onChangeText={setFreezeReason} />
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalBtnCancel} onPress={() => setFreezeModal(null)}>
                <Text style={s.modalBtnCancelText}>Odustani</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalBtnConfirm} onPress={freezeUser}>
                <Text style={s.modalBtnConfirmText}>Zamrzni</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
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
  scheduleDayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  scheduleDateLabel: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.small, color: Colors.foreground, backgroundColor: Colors.secondary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, overflow: 'hidden' },
  deleteDayBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.danger },
  deleteDayText: { fontFamily: Fonts.bodySemiBold, fontSize: 11, color: Colors.danger },
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
  noteModalSaveBtn: { width: '100%', height: 48, borderRadius: 9999, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  noteModalSaveBtnText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.body, color: Colors.white },
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
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  todayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  todayTime: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  todayTimeText: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.white },
  subScreenBack: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, marginTop: 8 },
  subScreenBackText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.body, color: Colors.foreground },
  // Package requests
  requestRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  requestInfo: { flex: 1 },
  requestActions: { flexDirection: 'row', gap: 8 },
  approveBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#059669', justifyContent: 'center', alignItems: 'center' },
  rejectBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.danger, justifyContent: 'center', alignItems: 'center' },
  // Sub-section tabs
  subTabs: { flexDirection: 'row', gap: 6, marginBottom: 16, flexWrap: 'wrap' },
  subTab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: Colors.secondary },
  subTabActive: { backgroundColor: Colors.primary },
  subTabText: { fontFamily: Fonts.bodySemiBold, fontSize: 11, color: Colors.primary },
  subTabTextActive: { color: Colors.white },
  warningDot: { backgroundColor: Colors.danger, borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  warningDotText: { fontFamily: Fonts.bodyBold, fontSize: 9, color: '#FFF' },
  // Monthly cards
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthName: { fontFamily: Fonts.heading, fontSize: 16, color: Colors.foreground },
  monthTotal: { fontFamily: Fonts.bodyBold, fontSize: 22, color: Colors.primary, marginTop: 2 },
  monthDetail: { marginTop: 16, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 },
  changeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  changeText: { fontFamily: Fonts.bodySemiBold, fontSize: 12 },
  detailLabel: { fontFamily: Fonts.bodySemiBold, fontSize: 11, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  // Bar chart
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  barLabel: { fontFamily: Fonts.bodySemiBold, fontSize: 12, color: Colors.foreground, width: 55 },
  barBg: { flex: 1, height: 20, backgroundColor: Colors.secondary, borderRadius: 10, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 10, minWidth: 4 },
  barValue: { fontFamily: Fonts.bodyBold, fontSize: 12, color: Colors.foreground, width: 40, textAlign: 'right' },
  // Mini stats
  miniStat: { flex: 1, ...CardStyle, padding: 14, alignItems: 'center' },
  miniStatValue: { fontFamily: Fonts.heading, fontSize: 24, color: Colors.primary },
  miniStatLabel: { fontFamily: Fonts.body, fontSize: 10, color: Colors.muted, textAlign: 'center', marginTop: 4 },
  // Compare
  compareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 12 },
  compareBox: { alignItems: 'center' },
  compareValue: { fontFamily: Fonts.heading, fontSize: 28, color: Colors.primary },
  compareLabel: { fontFamily: Fonts.body, fontSize: 12, color: Colors.muted, marginTop: 4 },
  // Category selector
  catRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  catBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.inputBorder, alignItems: 'center' },
  catBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catBtnText: { fontFamily: Fonts.bodySemiBold, fontSize: 13, color: Colors.foreground },
  catBtnTextActive: { color: Colors.white },
});
