import type { NavigationContainerRef } from '@react-navigation/native';

/**
 * Deep-link from Expo push `data` (Cloud Functions) into the root tab navigator + nested stacks.
 */
export function navigateFromNotificationData(
  nav: NavigationContainerRef<any> | null | undefined,
  raw: Record<string, unknown> | undefined
): void {
  if (!nav?.isReady() || !raw || typeof raw !== 'object') return;
  const type = String(raw.type ?? '');

  try {
    switch (type) {
      case 'chat': {
        const messageId = String(raw.messageId ?? '').trim();
        if (messageId) {
          nav.navigate('Chat', { screen: 'ChatMain', params: { messageId } });
        } else {
          nav.navigate('Chat', { screen: 'ChatMain' });
        }
        break;
      }
      case 'nudge':
        nav.navigate('Nudge');
        break;
      case 'heartbeat':
        nav.navigate('Heartbeat');
        break;
      case 'shared_sky':
        nav.navigate('SharedSky');
        break;
      case 'soft_location':
        nav.navigate('SoftLocation');
        break;
      case 'mood':
        nav.navigate('MoodSync');
        break;
      case 'daily_snap':
        nav.navigate('Snap', { screen: 'DailySnap' });
        break;
      case 'together_sync': {
        const target = String(raw.togetherTarget ?? 'hub');
        const screenMap: Record<string, string> = {
          hub: 'TogetherHub',
          trips: 'OurTripsTogether',
          wishes: 'WishJar',
          journal: 'SharedJournal',
          goals: 'CoupleGoals',
          countdown: 'CountdownTogether',
        };
        const screen = screenMap[target] ?? 'TogetherHub';
        nav.navigate('Together', { screen });
        break;
      }
      default:
        nav.navigate('Home');
    }
  } catch {
    // Navigator not ready or route missing
  }
}
