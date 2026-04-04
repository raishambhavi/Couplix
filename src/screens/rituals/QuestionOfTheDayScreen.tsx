import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AmbientBackground } from '../../components/AmbientBackground';
import { FloatingBackButton } from '../../components/FloatingBackButton';
import { GoldButton } from '../../components/GoldButton';
import { SoftCard } from '../../components/SoftCard';
import { useRituals } from '../../state/RitualsContext';
import { useTheme } from '../../state/ThemeContext';

export function QuestionOfTheDayScreen() {
  const { colors } = useTheme();
  const {
    partnerName,
    coupleMode,
    currentQotd,
    nextQotd,
    myQ,
    setMyQ,
    partnerQ,
    setPartnerQ,
    saveRitualsState,
  } = useRituals();

  return (
    <>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <SoftCard>
          <Text style={[styles.sub, { color: colors.muted }]}>
            120 curated prompts — one random question at a time. Set to{' '}
            <Text style={{ fontWeight: '900', color: colors.gold }}>
              {coupleMode === 'together' ? 'living together' : 'long distance'}
            </Text>{' '}
            on Home or Settings.
          </Text>
          <Text style={[styles.body, { color: colors.text }]}>{currentQotd}</Text>
          <GoldButton
            title="Next question"
            onPress={() => {
              nextQotd();
              setMyQ('');
              setPartnerQ('');
            }}
            style={{ marginTop: 8 }}
          />
          <TextInput
            value={myQ}
            onChangeText={setMyQ}
            placeholder="Your private answer"
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            multiline
          />
          <TextInput
            value={partnerQ}
            onChangeText={setPartnerQ}
            placeholder={`${partnerName || 'Partner'} answer (for MVP testing)`}
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            multiline
          />
          <GoldButton
            title="Save Answers"
            onPress={() => saveRitualsState({ partnerQ }).catch(() => {})}
            style={{ marginTop: 8 }}
          />
          <View style={[styles.reveal, { borderColor: colors.border }]}>
            {myQ.trim() && partnerQ.trim() ? (
              <Text style={[styles.meta, { color: colors.text }]}>
                You: {myQ}
                {'\n\n'}
                {partnerName || 'Partner'}: {partnerQ}
              </Text>
            ) : (
              <Text style={[styles.meta, { color: colors.muted }]}>
                Blind mode active. Both answers required to reveal.
              </Text>
            )}
          </View>
        </SoftCard>
      </ScrollView>
      <FloatingBackButton />
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32, gap: 14 },
  sub: { marginTop: 4, fontSize: 12, fontWeight: '700' },
  body: { marginTop: 10, fontSize: 14, fontWeight: '800', lineHeight: 20 },
  meta: { marginTop: 8, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  input: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: 'rgba(231,199,125,0.05)',
    fontWeight: '700',
  },
  reveal: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    backgroundColor: 'rgba(231,199,125,0.06)',
  },
});
