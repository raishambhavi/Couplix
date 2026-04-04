import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

const EMOJIS = ['🎊', '✨', '💕', '🎉', '⭐', '💫'];

export function ConfettiCelebration({
  visible,
  title,
  subtitle,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  const anims = useRef(EMOJIS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!visible) return;
    const loops = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(a, { toValue: 1, duration: 1400 + i * 120, useNativeDriver: true }),
          Animated.timing(a, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [visible, anims]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.emojiRow}>
            {EMOJIS.map((e, i) => {
              const y = anims[i].interpolate({ inputRange: [0, 1], outputRange: [0, -18] });
              const rot = anims[i].interpolate({ inputRange: [0, 1], outputRange: ['0deg', '18deg'] });
              return (
                <Animated.Text key={e + i} style={[styles.emoji, { transform: [{ translateY: y }, { rotate: rot }] }]}>
                  {e}
                </Animated.Text>
              );
            })}
          </View>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
          <Pressable onPress={onClose} style={styles.btn}>
            <Text style={styles.btnText}>Lovely</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,10,20,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 22,
    padding: 22,
    backgroundColor: 'rgba(40,32,48,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(231,199,125,0.45)',
    alignItems: 'center',
    gap: 12,
  },
  emojiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  emoji: { fontSize: 28 },
  title: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    color: '#FDF6EC',
    lineHeight: 26,
  },
  sub: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
  btn: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#E7C77D',
  },
  btnText: { fontSize: 15, fontWeight: '900', color: '#1A1510' },
});
