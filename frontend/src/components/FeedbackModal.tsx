import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Fonts, Sizes, formatDateBosnian } from '../theme';
import { feedbackAPI } from '../api';

interface PendingTraining {
  training_id?: string;
  id?: string;
  datum?: string;
  vrijeme?: string;
  date?: string;
  time?: string;
}

interface Props {
  training: PendingTraining;
  visible: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

const emojis = ['😔', '😐', '🙂', '😊', '🤩'];

export default function FeedbackModal({ training, visible, onClose, onSubmitted }: Props) {
  const [fizicko, setFizicko] = useState(0);
  const [kvalitet, setKvalitet] = useState(0);
  const [napredak, setNapredak] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = fizicko > 0 && kvalitet > 0 && napredak > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await feedbackAPI.submit({
        training_id: training.training_id || training.id || '',
        fizicko_stanje: fizicko,
        kvalitet_treninga: kvalitet,
        osjecaj_napretka: napredak,
      });
      onSubmitted();
    } catch (e) {
      console.error('Feedback error:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const datum = training.datum || training.date || '';
  const vrijeme = training.vrijeme || training.time || '';

  const RatingRow = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
    <View style={styles.ratingRow}>
      <Text style={styles.ratingLabel}>{label}</Text>
      <View style={styles.emojiRow}>
        {emojis.map((emoji, i) => (
          <TouchableOpacity
            key={i}
            testID={`feedback-${label.toLowerCase().replace(/\s/g, '-')}-${i + 1}`}
            onPress={() => onChange(i + 1)}
            style={[styles.emojiBtn, value === i + 1 && styles.emojiBtnActive]}
          >
            <Text style={[styles.emoji, value !== i + 1 && styles.emojiInactive]}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <TouchableOpacity testID="feedback-close" style={styles.closeBtn} onPress={onClose}>
            <Feather name="x" size={20} color={Colors.muted} />
          </TouchableOpacity>
          <Text style={styles.title}>Kako ti je prijao trening?</Text>
          {datum ? (
            <Text style={styles.info}>
              {formatDateBosnian(datum)} • {vrijeme}
            </Text>
          ) : null}

          <RatingRow label="Fizičko stanje" value={fizicko} onChange={setFizicko} />
          <RatingRow label="Kvalitet treninga" value={kvalitet} onChange={setKvalitet} />
          <RatingRow label="Osjećaj napretka" value={napredak} onChange={setNapredak} />

          <TouchableOpacity
            testID="feedback-submit-btn"
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            <Text style={styles.submitText}>{submitting ? 'Šaljem...' : 'Pošalji'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: Colors.cardBg,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  closeBtn: { position: 'absolute', top: 16, right: 16, zIndex: 1 },
  title: {
    fontFamily: Fonts.heading,
    fontSize: Sizes.h3,
    color: Colors.foreground,
    textAlign: 'center',
    marginBottom: 8,
  },
  info: {
    fontFamily: Fonts.body,
    fontSize: Sizes.small,
    color: Colors.muted,
    textAlign: 'center',
    marginBottom: 20,
  },
  ratingRow: { marginBottom: 16 },
  ratingLabel: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: Sizes.small,
    color: Colors.foreground,
    marginBottom: 8,
  },
  emojiRow: { flexDirection: 'row', justifyContent: 'space-between' },
  emojiBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiBtnActive: {
    backgroundColor: Colors.primary,
    transform: [{ scale: 1.1 }],
  },
  emoji: { fontSize: 24 },
  emojiInactive: { opacity: 0.5 },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 9999,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontFamily: Fonts.bodySemiBold, fontSize: Sizes.body, color: Colors.white },
});
