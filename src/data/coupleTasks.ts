/**
 * Curated couple tasks: split by relationship mode (together vs long distance) and by cadence
 * (weekday = lighter / less logistics; weekend = more energetic / bigger outings).
 */

export type CoupleTaskMode = 'together' | 'longDistance';
export type TaskCadence = 'weekday' | 'weekend';

/** Uses the same UTC calendar day as `dateKey` / ritual day keys (YYYY-MM-DD). */
export function cadenceForDateKey(dateKey: string): TaskCadence {
  const [y, m, d] = dateKey.split('-').map((x) => Number(x));
  if (!y || !m || !d) return 'weekday';
  const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dow = utc.getUTCDay();
  return dow === 0 || dow === 6 ? 'weekend' : 'weekday';
}

/** Lighter shared moments — home, short dates, low prep (Mon–Fri UTC). */
export const SHARED_EXPERIENCE_TASKS_TOGETHER_WEEKDAY: readonly string[] = [
  'Plan a movie date night',
  'Cook a new recipe together',
  'Have a game night at home',
  'Build a blanket fort and watch movies',
  'Have a spa night at home',
  'Write each other a letter by hand',
  'Watch the sunrise or sunset together',
  'Plan your next holiday together',
  'Create a shared bucket list of 20 things and number them by priority',
  'Plant something together — a herb, a succulent, anything living',
  'Build a shared photo album or scrapbook of the last 6 months',
  "Each teach the other something you know that they don't",
  "Write your relationship 'vows' or a private love letter to each other",
  'Create a shared document of your favourite memories together — add to it monthly',
  'Make a playlist for every mood — one for mornings, drives, evenings, and rainy days',
  'Learn a card trick, magic trick, or party game together',
  "Each write the other a list of '101 reasons I love you'",
  'Design your dream home together using Pinterest or just a notebook',
  'Have a meaningful conversation with no interruptions for 30 minutes — one person speaks, one listens, then swap',
  'Try a new restaurant',
];

/** Bigger outings and projects (Sat–Sun UTC). */
export const SHARED_EXPERIENCE_TASKS_TOGETHER_WEEKEND: readonly string[] = [
  'Go on a hike together',
  "Visit a farmer's market",
  'Go stargazing',
  'Take a spontaneous day trip',
  'Have a picnic in the park',
  'Attend a live music event',
  'Visit a museum or art gallery together',
  'Do a DIY project at home',
  'Try a couples workout class',
  'Go thrifting or explore a new neighbourhood',
  'Try a pottery, painting, or cooking class',
  'Rearrange one room in the house together and see if you love it',
  'Host a dinner party together for friends — plan and cook as a team',
  "Visit a local market you've never been to and cook with what you find",
  'Volunteer together for a few hours at a local cause',
  'Take a pottery, ceramics, or art class together',
  'Do a digital detox Sunday — no phones from 9am to 9pm',
  'Take a day trip somewhere within 2 hours that neither of you has been',
  'Go to a comedy show, theatre performance, or live gig together',
  'Take a long bike ride or hike with a picnic packed',
  'Do an escape room together',
  'Spend a full morning at a bookshop — each pick a book for the other to read',
  'Plan a staycation weekend — treat your own home like a hotel',
  'Sign up for a charity run or challenge and train together',
  "Try a new sport or activity you've never done — surfing, archery, trampolining",
  'Do a full declutter of one space together and donate what you clear',
  "Have a 'yes day' — one person plans the whole day, the other says yes to everything",
  "Go to a farmers' market and cook a full three-course meal from scratch",
  'Find a local festival, fair, or street market and spend the afternoon wandering',
  'Take a photography walk around your neighbourhood — theme: colour',
];

/** Daily check-ins and short syncs (Mon–Fri UTC). */
export const WELLNESS_CONNECTION_TASKS_LONG_DISTANCE_WEEKDAY: readonly string[] = [
  'Exercise for 20+ minutes',
  'Ate protein today',
  'Drank 8 glasses of water',
  'Sent a good morning message',
  'Shared one photo from your day',
  'Had a video call today',
  'Read for at least 20 minutes',
  'Cooked a healthy meal',
  'Watched the same movie tonight',
  'Journaled today',
  'Sent a voice note to your partner',
  'Went for a walk outside',
  'Meditated or stretched today',
  'Told your partner one thing you love about them',
  'Made your bed this morning',
  "Shared what you're grateful for today",
  'Tried something new today',
  'Played a game together online',
  'Cooked the same meal at the same time',
  'Set a shared Google Calendar for the next 3 months of visits and milestones',
  "Each create a 'care package' wishlist and share it — for when you next send one",
  'Watch the same documentary and discuss it on a call',
  "Each build a Spotify playlist for the other's current life season",
  'Both cook the same recipe on the same night — video call while eating',
  "Create a shared Google Doc 'love language' list — what makes each of you feel loved",
  'Both write down your top 10 favourite memories together and compare lists',
  'Do a virtual home tour update — show each other any changes to your space',
  "Each write 10 questions you've never asked each other — save them for the next call",
  'Order food from the same chain (if possible) or same type of cuisine on the same night',
  "Both do a journaling session on the same prompt: 'What I love most about us is...'",
  'Create a shared Pinterest board for your future home, holiday, or wedding',
  'Both meditate at the same time using the same guided meditation',
  'Share one song that fits your day and tell each other why in one sentence',
  'Send a "thinking of you" text with no pressure to start a long chat',
  'During your next call, both sip the same kind of drink and toast on camera',
];

/** Bigger coordinated rituals across distance (Sat–Sun UTC). */
export const WELLNESS_CONNECTION_TASKS_LONG_DISTANCE_WEEKEND: readonly string[] = [
  'Sent a surprise delivery or gift',
  'Both write a letter by hand and post it — the old-fashioned way',
  'Both do a full fridge and pantry clean-out on the same day',
  'Both take a photo every hour for one full day and share them at the end',
  'Both go for a run or walk on the same route (can be in different cities) at the same time',
  "Read the same book simultaneously and schedule a 'book club' call when done",
  'Write out your 5-year vision individually and compare over a long call',
  'Each take a 10-photo series of your week and share it as a mini photo essay',
  'Plan your next visit in complete detail — accommodation, food, activities',
  'Both sign up for the same online course and work through it together',
  "Each send one physical item that represents how you're feeling right now",
  "Have a 'morning coffee call' for 5 days in a row — no agenda, just being together",
  'Both take a long bath or shower at the same time while on a voice call',
  "Each make a 'day in my life' short video and share it",
  'Each write a letter to the future version of your relationship — seal it to open on your next anniversary',
  'Plan a virtual date night with a proper setup — candles, dressed up, food, a film',
  'Both complete a personality test (MBTI, love languages, enneagram) and compare results',
  "Make each other a virtual 'mood board' for where you see life going this year",
];

export function getTaskList(mode: CoupleTaskMode, cadence: TaskCadence): readonly string[] {
  if (mode === 'together') {
    return cadence === 'weekend' ? SHARED_EXPERIENCE_TASKS_TOGETHER_WEEKEND : SHARED_EXPERIENCE_TASKS_TOGETHER_WEEKDAY;
  }
  return cadence === 'weekend' ? WELLNESS_CONNECTION_TASKS_LONG_DISTANCE_WEEKEND : WELLNESS_CONNECTION_TASKS_LONG_DISTANCE_WEEKDAY;
}

export function taskKey(mode: CoupleTaskMode, cadence: TaskCadence, index: number) {
  return `${mode}:${cadence}:${index}`;
}

export function daySeedIndex(dateKey: string, length: number) {
  if (length <= 0) return 0;
  let h = 0;
  for (let i = 0; i < dateKey.length; i++) h = (h * 31 + dateKey.charCodeAt(i)) | 0;
  return Math.abs(h) % length;
}
