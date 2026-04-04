import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../state/ThemeContext';

type IndexItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

export function FeatureIndexModal({
  visible,
  onClose,
  items,
}: {
  visible: boolean;
  onClose: () => void;
  items: IndexItem[];
}) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.drawer,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={() => {}}
        >
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Features</Text>
            <Pressable onPress={onClose} hitSlop={12} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.list}>
            {items.map((it) => (
              <Pressable
                key={it.key}
                onPress={() => {
                  onClose();
                  it.onPress();
                }}
                style={({ pressed }) => [
                  styles.row,
                  {
                    borderBottomColor: colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <View style={styles.rowLeft}>
                  <Ionicons name={it.icon} size={20} color={colors.gold} />
                  <Text style={[styles.rowLabel, { color: colors.text }]}>{it.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
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
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  drawer: {
    width: '84%',
    maxWidth: 360,
    height: '100%',
    borderWidth: 1,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 56,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  list: {
    paddingTop: 6,
    paddingBottom: 20,
  },
  row: {
    minHeight: 52,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
});

