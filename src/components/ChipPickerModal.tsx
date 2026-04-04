import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../state/ThemeContext';

export function ChipPickerModal<T extends string | number>({
  visible,
  title,
  options,
  formatLabel,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: T[];
  formatLabel?: (v: T) => string;
  onPick: (v: T) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const label = (v: T) => (formatLabel ? formatLabel(v) : String(v));
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => {}}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {options.map((opt) => (
              <Pressable
                key={String(opt)}
                onPress={() => {
                  onPick(opt);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.row,
                  { borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.rowText, { color: colors.text }]}>{label(opt)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    padding: 14,
  },
  sheet: {
    maxHeight: '72%',
    borderRadius: 18,
    borderWidth: 1,
    paddingBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  scroll: { maxHeight: 420 },
  scrollContent: { paddingHorizontal: 10, paddingBottom: 8, gap: 6 },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowText: { fontSize: 15, fontWeight: '800' },
});
