import React from 'react';
import { Alert, Linking, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { AmbientBackground } from '../components/AmbientBackground';
import { FloatingBackButton } from '../components/FloatingBackButton';
import { GoldButton } from '../components/GoldButton';
import { ScreenHeading } from '../components/ScreenHeading';
import { SoftCard } from '../components/SoftCard';
import { useTheme } from '../state/ThemeContext';

async function shareText(message: string) {
  try {
    await Share.share({ message });
  } catch {
    // ignore
  }
}

export function GrowthScreen() {
  const { colors } = useTheme();

  return (
    <>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeading
          title="Growth"
          subtitle="Virality & growth mechanics built for organic sharing."
        />

        <SoftCard>
          <Text style={[styles.h, { color: colors.text }]}>Quarterly Memory Video</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>
            Share quarterly memory videos directly with a branded Tether watermark.
          </Text>
          <GoldButton
            title="Share quarterly video"
            onPress={() =>
              shareText(
                'Quarterly Memory Video by Tether ✨\nA 90-second love recap from our shared moments. #Tether #CoupleApp'
              )
            }
            style={{ marginTop: 10 }}
          />
        </SoftCard>

        <SoftCard>
          <Text style={[styles.h, { color: colors.text }]}>Weekly Collage for Stories</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>
            Weekly collages are formatted for Instagram Stories and easy reposts.
          </Text>
          <GoldButton
            title="Share story-ready collage"
            onPress={() =>
              shareText(
                'Our weekly collage (Story format) 💛\nBuilt with Tether for easy Instagram Story sharing.'
              )
            }
            style={{ marginTop: 10 }}
          />
        </SoftCard>

        <SoftCard>
          <Text style={[styles.h, { color: colors.text }]}>Memory Map Prints</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>
            Turn Memory Map posters into physical prints via in-app print partner integration.
          </Text>
          <GoldButton
            title="Order Memory Map print"
            onPress={async () => {
              const url = 'https://example.com/tether-memory-map-prints';
              const supported = await Linking.canOpenURL(url);
              if (supported) await Linking.openURL(url);
              else Alert.alert('Print integration', 'Print ordering integration is currently unavailable.');
            }}
            style={{ marginTop: 10 }}
          />
        </SoftCard>

        <SoftCard>
          <Text style={[styles.h, { color: colors.text }]}>Heartbeat Share Virality</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>
            Heartbeat moments are screenshot-worthy and TikTok-friendly by design.
          </Text>
          <GoldButton
            title="Share Heartbeat moment"
            onPress={() =>
              shareText(
                'Heartbeat Share 💓\nThis is the sweetest long-distance feature we have used. #Tether #LongDistanceLove'
              )
            }
            style={{ marginTop: 10 }}
          />
        </SoftCard>

        <SoftCard>
          <Text style={[styles.h, { color: colors.text }]}>100-Day Streak Milestone Card</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>
            Reaching 100 days generates a shareable milestone card for social media.
          </Text>
          <GoldButton
            title="Share 100-day milestone card"
            onPress={() =>
              shareText(
                '100 days strong with Tether 🏆💛\nConsistency, rituals, and tiny daily love moments.'
              )
            }
            style={{ marginTop: 10 }}
          />
        </SoftCard>

        <SoftCard>
          <Text style={[styles.h, { color: colors.text }]}>Year-in-Review Booklet</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>
            Export your year-in-review as a PDF or order a printed photobook.
          </Text>
          <View style={styles.row}>
            <GoldButton
              title="Export PDF"
              onPress={() =>
                shareText(
                  'Year-in-review booklet (PDF) by Tether 📘\nA full recap of our shared year together.'
                )
              }
              style={{ flex: 1 }}
            />
            <GoldButton
              title="Order photobook"
              onPress={async () => {
                const url = 'https://example.com/tether-yearbook-print';
                const supported = await Linking.canOpenURL(url);
                if (supported) await Linking.openURL(url);
                else Alert.alert('Photobook', 'Print ordering integration is currently unavailable.');
              }}
              style={{ flex: 1 }}
            />
          </View>
        </SoftCard>
      </ScrollView>
      <FloatingBackButton />
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 108, paddingBottom: 32, gap: 14 },
  h: { fontSize: 16, fontWeight: '900' },
  sub: { marginTop: 4, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
});

