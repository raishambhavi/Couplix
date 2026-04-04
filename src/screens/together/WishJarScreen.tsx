import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AmbientBackground } from '../../components/AmbientBackground';
import { FloatingBackButton } from '../../components/FloatingBackButton';
import { GoldButton } from '../../components/GoldButton';
import { SoftCard } from '../../components/SoftCard';
import { useAuth } from '../../state/AuthContext';
import { dateISO, useTogether, type WishItem } from '../../state/TogetherContext';
import { useTheme } from '../../state/ThemeContext';

function renderWishRows(wishes: WishItem[], colors: ReturnType<typeof useTheme>['colors']) {
  return wishes.map((w) => {
    const locked = !!w.lockDate && w.lockDate > dateISO();
    return (
      <View key={w.id} style={[styles.rowCard, { borderColor: colors.border }]}>
        <Text style={[styles.meta, { color: colors.text, flex: 1, minWidth: 0 }]} numberOfLines={2}>
          {locked ? 'Locked wish' : w.text}
        </Text>
        <Text style={[styles.meta, { color: colors.muted, flexShrink: 0 }]} numberOfLines={1}>
          {w.lockDate ? `until ${w.lockDate}` : 'open'}
        </Text>
      </View>
    );
  });
}

export function WishJarScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { wishes, addWish } = useTogether();
  const [wishDraft, setWishDraft] = useState('');
  const [wishLockDate, setWishLockDate] = useState('');

  const { legacyWishes, myWishes, partnerWishes } = useMemo(() => {
    const uid = user?.uid;
    const legacy = wishes.filter((w) => !w.createdByUid);
    const mine = wishes.filter((w) => w.createdByUid && uid && w.createdByUid === uid);
    const theirs = wishes.filter((w) => w.createdByUid && uid && w.createdByUid !== uid);
    return { legacyWishes: legacy, myWishes: mine, partnerWishes: theirs };
  }, [wishes, user?.uid]);

  const wishSuggestions = useMemo(() => {
    const src = wishes.map((w) => w.text.toLowerCase()).join(' ');
    const out: string[] = [];
    if (src.includes('travel') || src.includes('trip') || src.includes('holiday')) out.push('Weekend getaway package');
    if (src.includes('dinner') || src.includes('restaurant') || src.includes('food')) out.push('Chef tasting date night');
    if (src.includes('gift') || src.includes('flowers')) out.push('Surprise gift bundle');
    if (src.includes('class') || src.includes('learn')) out.push('Pottery / painting workshop');
    if (out.length === 0) out.push('Sunset picnic experience', 'Live music date tickets');
    return out.slice(0, 3);
  }, [wishes]);

  return (
    <>
      <AmbientBackground />
      <ScrollView
        stickyHeaderIndices={[0]}
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.stickyHeader, { backgroundColor: colors.background }]}>
          <SoftCard>
            <Text style={[styles.sub, { color: colors.muted }]}>
              Add wishes anytime. Lock reveals until birthdays, anniversaries, or surprise days.
            </Text>
            <TextInput
              value={wishDraft}
              onChangeText={setWishDraft}
              placeholder="Drop a wish..."
              placeholderTextColor={colors.muted}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Lock until date</Text>
            <TextInput
              value={wishLockDate}
              onChangeText={setWishLockDate}
              placeholder={`YYYY-MM-DD, e.g. ${dateISO()}`}
              placeholderTextColor={colors.muted}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            <GoldButton
              title="Add wish"
              onPress={() => {
                addWish(wishDraft, wishLockDate);
                setWishDraft('');
                setWishLockDate('');
              }}
              style={{ marginTop: 8 }}
            />
            <Text style={[styles.sub, { color: colors.muted, marginTop: 10 }]}>AI suggestions:</Text>
            {wishSuggestions.map((s) => (
              <Text key={s} style={[styles.meta, { color: colors.gold }]}>
                • {s}
              </Text>
            ))}
          </SoftCard>
        </View>

        <View style={styles.listSection}>
          {!user?.uid ? (
            <SoftCard>
              <Text style={[styles.listTitle, { color: colors.text }]}>Your wishes</Text>
              {wishes.length === 0 ? (
                <Text style={[styles.sectionHint, { color: colors.muted }]}>No wishes yet — add one above.</Text>
              ) : (
                <View style={{ gap: 8 }}>{renderWishRows(wishes, colors)}</View>
              )}
            </SoftCard>
          ) : (
            <>
              {legacyWishes.length > 0 ? (
                <SoftCard>
                  <Text style={[styles.listTitle, { color: colors.text }]}>Wishes</Text>
                  <Text style={[styles.sectionHint, { color: colors.muted }]}>
                    From before names were tracked — visible to both of you.
                  </Text>
                  <View style={{ gap: 8 }}>{renderWishRows(legacyWishes, colors)}</View>
                </SoftCard>
              ) : null}

              {myWishes.length > 0 ? (
                <SoftCard>
                  <Text style={[styles.listTitle, { color: colors.text }]}>Your wishes</Text>
                  <View style={{ gap: 8 }}>{renderWishRows(myWishes, colors)}</View>
                </SoftCard>
              ) : null}

              {partnerWishes.length > 0 ? (
                <SoftCard>
                  <Text style={[styles.listTitle, { color: colors.text }]}>Your partner&apos;s wishes</Text>
                  <View style={{ gap: 8 }}>{renderWishRows(partnerWishes, colors)}</View>
                </SoftCard>
              ) : null}

              {legacyWishes.length === 0 && myWishes.length === 0 && partnerWishes.length === 0 ? (
                <SoftCard>
                  <Text style={[styles.listTitle, { color: colors.text }]}>Your wishes</Text>
                  <Text style={[styles.sectionHint, { color: colors.muted }]}>No wishes yet — add one above.</Text>
                </SoftCard>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
      <FloatingBackButton />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32, gap: 14 },
  stickyHeader: {
    paddingBottom: 4,
  },
  listSection: {
    gap: 14,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 10,
  },
  sectionHint: { fontSize: 12, fontWeight: '700', marginBottom: 10, lineHeight: 17 },
  fieldLabel: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sub: { marginTop: 4, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  meta: { fontSize: 12, fontWeight: '700' },
  input: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: 'rgba(231,199,125,0.05)',
    fontWeight: '700',
  },
  rowCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

