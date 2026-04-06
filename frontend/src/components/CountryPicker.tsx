import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, TextInput, StyleSheet, SafeAreaView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Fonts, Sizes } from '../theme';
import { countries, Country } from '../data/countries';

interface Props {
  selected: Country;
  onSelect: (c: Country) => void;
}

export default function CountryPicker({ selected, onSelect }: Props) {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = search
    ? countries.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dial.includes(search) ||
        c.code.toLowerCase().includes(search.toLowerCase())
      )
    : countries;

  return (
    <>
      <TouchableOpacity
        testID="country-picker-btn"
        style={styles.trigger}
        onPress={() => setVisible(true)}
      >
        <Text style={styles.flag}>{selected.flag}</Text>
        <Text style={styles.dial}>{selected.dial}</Text>
        <Feather name="chevron-down" size={14} color={Colors.muted} />
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Odaberite državu</Text>
            <TouchableOpacity testID="country-picker-close" onPress={() => setVisible(false)}>
              <Feather name="x" size={24} color={Colors.foreground} />
            </TouchableOpacity>
          </View>
          <View style={styles.searchBox}>
            <Feather name="search" size={18} color={Colors.muted} />
            <TextInput
              testID="country-search-input"
              style={styles.searchInput}
              placeholder="Pretraži..."
              placeholderTextColor={Colors.muted}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={item => item.code}
            renderItem={({ item }) => (
              <TouchableOpacity
                testID={`country-${item.code}`}
                style={[styles.item, item.code === selected.code && styles.itemActive]}
                onPress={() => { onSelect(item); setVisible(false); setSearch(''); }}
              >
                <Text style={styles.itemFlag}>{item.flag}</Text>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemDial}>{item.dial}</Text>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 6,
  },
  flag: { fontSize: 20 },
  dial: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.small, color: Colors.foreground },
  modal: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontFamily: Fonts.heading, fontSize: Sizes.h3, color: Colors.foreground },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 12,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: Sizes.body,
    color: Colors.foreground,
    paddingVertical: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  itemActive: { backgroundColor: Colors.secondary },
  itemFlag: { fontSize: 24 },
  itemName: { flex: 1, fontFamily: Fonts.body, fontSize: Sizes.body, color: Colors.foreground },
  itemDial: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.small, color: Colors.muted },
});
