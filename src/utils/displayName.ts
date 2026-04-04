/** Display name for attribution (Together wishes, trips, journal). */
export function displayNameFromProfile(
  profile: { displayName: string | null } | null | undefined,
  user: { displayName: string | null } | null | undefined
): string {
  const n = profile?.displayName?.trim() || user?.displayName?.trim();
  return n && n.length > 0 ? n : 'Partner';
}
