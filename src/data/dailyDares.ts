/** Living-together vs long-distance + rotation pool vs tiered dares. */

import { isWeekendUtc, permutedPoolIndex } from '../utils/ritualDeterminism';

export type CoupleMode = 'together' | 'longDistance';
export type DareTierKind = 'rotation' | 'fun' | 'deep' | 'spicy';

export const DAILY_DARES: Record<CoupleMode, Record<DareTierKind, readonly string[]>> = {
  together: {
    rotation: [
      'Cook a meal together using only ingredients already in the fridge',
      'Give each other a 10-minute massage without checking your phone',
      'Leave a handwritten note somewhere the other will find it today',
      'Take a photo of each other doing something ordinary and make it beautiful',
      "Do the other person's most-hated chore for them without being asked",
      'Sit together in complete silence for 5 minutes — no screens, just presence',
      "Make each other's favourite childhood snack",
      "Watch one episode of a show the other person loves but you haven't tried",
      'Take a 20-minute walk with no destination — just wander and talk',
      'Write down 3 things you love about the other person and read them aloud',
      'Dance together in the kitchen to one full song',
      'Plan a date night for next week — surprise the other with the details',
      "Try a 5-minute sketch of each other's face — no erasing allowed",
      'Make your partner breakfast in bed or at their desk',
      'Read the first chapter of a book aloud to each other',
      'Have a 15-minute conversation with no phones in the room',
      'Build something together — a puzzle, a piece of IKEA furniture, anything',
      'Watch the sunrise or sunset together without talking',
      'Write each other a letter as if you were in a long-distance relationship',
      'Each person shares one memory of the other they have not mentioned before',
      'Create a shared playlist of 5 songs that feel like your relationship',
      'Take a new route home together and notice one thing you have never seen before',
      'Try one new food or cuisine together tonight',
      'Share what your ideal Saturday together looks like — see if they match',
      'Find a YouTube tutorial and learn something new together in 20 minutes',
      'Each write down your favourite memory of this month and compare',
      'Do a screen-free hour together — decide together what to fill it with',
      'Share the last dream you remember and try to analyse it together',
      'Make a wish list of 5 things you want to do together before end of year',
      'Look through old photos together and share one story behind each',
    ],
    fun: [
      'Text each other a GIF that describes your current mood — no explanation allowed',
      'See who can hold a plank longer — loser makes dinner',
      'Swap phones for 10 minutes — only looking at camera rolls',
      'Each do your worst impression of the other person',
      'Write a fake one-star review of your partner as a housemate',
      'Play rock paper scissors for who picks the movie tonight',
      'Both draw a portrait of each other in 90 seconds using your non-dominant hand',
      "See who can name more of each other's friends — winner picks the takeaway",
      'Both strike your most dramatic pose and take a photo',
      'Do your best celebrity impression and the other has to guess it',
      'Create a TikTok-style dance to the first song that comes on shuffle',
      'Each come up with a nickname for the other — they have to use it all day',
      'Play 20 questions but one person thinks of a memory you share',
      'Both try to cook something with your eyes closed for one step',
      'Make up a theme song for your relationship — 30 seconds, sung aloud',
    ],
    deep: [
      'Share one fear about the future that you have not said out loud before',
      'Describe the moment you knew this relationship was something real',
      'Tell each other one thing you have changed your mind about since being together',
      'Share something your partner does that you secretly find deeply comforting',
      'Ask: what is something you think I misunderstand about you?',
      'Describe your relationship in terms of a season — and explain why',
      'Share one thing you are still learning about how to love someone well',
      "What is one habit of your own you are working on for this relationship?",
      'Tell each other one moment from the early days that you still think about',
      'Ask: what does home feel like to you — and does this place feel like it?',
      'Share one thing you admire in your partner that you wish you had more of yourself',
      "What is one conversation you have been putting off that you need to have?",
      'Each share what your ideal future looks like in 5 years — compare honestly',
      'Tell each other one thing that always makes you feel truly seen by them',
      'Ask: is there anything you need from me right now that you have not asked for?',
    ],
    spicy: [
      'Describe your partner in 3 words — one for their mind, body, and soul',
      'Tell each other one thing you find incredibly attractive that is not physical',
      'Recreate your first date — same energy, same nerves',
      'Write a list of 5 things you want to do with them — sealed for later',
      'Send them a message as if you are flirting for the first time',
      'Both get dressed up with nowhere to go — dinner at home',
      'Tell them one thing they do that drives you wild',
      'Write your partner a three-sentence love letter — handwritten, no drafts',
      'Play two truths and a lie but make all three things relationship-related',
      'Ask: what is something you would love us to try together that we have not yet?',
      'Take a photo together that you are both genuinely proud of',
      'Put on music, turn off the lights, and just be close for one full song',
      'Tell each other what your absolute ideal day together would look like — every detail',
      'Both wear something the other picks for an hour — no complaints',
      'Ask: what is the most attractive thing I have done recently without realising it?',
    ],
  },
  longDistance: {
    rotation: [
      'Send a voice note describing exactly where you are and what you can see right now',
      'Take one photo this hour and send it with a caption that explains your mood',
      'Record a 30-second video tour of your current space',
      'Send each other the last song that made you feel something and say why',
      'Write one sentence about what you wish the other was here for right now',
      'Both open your windows and look at the sky at the same time — text what you see',
      'Send a voice message saying something you have been meaning to say',
      'Describe your day in exactly 10 words',
      'Each share one photo from your week that the other has not seen yet',
      'Both eat the same snack at the same time on a video call',
      'Tell each other one thing about your day that made you think of them',
      'Send a picture of the view from wherever you are right now',
      'Each buy yourself a small treat today and share a photo of it',
      'Both go outside and walk for 10 minutes while on a voice call together',
      'Send a voice note doing your best impression of each other',
      'Name one thing in your current room that reminds you of your partner',
      'Write out your ideal date night for when you next see each other',
      'Share one song you have been playing on repeat this week',
      'Describe your partner in 5 words — then ask them to do the same for you',
      'Both watch the same YouTube video tonight and share your reactions',
      'Send a photo of something that made you smile today',
      "Write what you would order if you could have any meal delivered to their door right now",
      'Both do 10 minutes of exercise at the same time and share your heart rate',
      'Send a voice message reading aloud one paragraph from a book you are reading',
      'Share your current desktop or phone wallpaper and explain why you chose it',
      'Both sit quietly for 3 minutes thinking about the other — then share what came up',
      'Share the most mundane thing that happened to you today in the most dramatic way possible',
      'Send a voice note saying 5 things you are looking forward to about the next visit',
      'Both cook something and share a photo before and after',
      "Write tomorrow's morning message tonight and schedule it to send at 7am",
    ],
    fun: [
      'Both open the same app (YouTube, Netflix, Spotify) at the exact same moment',
      'Send each other the most unflattering recent photo on your phone',
      'Both try to recreate the same meal in your respective kitchens tonight',
      'Voice note each other doing your best impression of each other',
      'Send a photo of your current outfit — rate each other 1–10',
      'Both go outside, take a photo of something green, and compare',
      'Play online Scrabble, chess, or any word game for 15 minutes',
      'Both set a 60-second timer and clean as much as possible — send your before and after',
      "Each describe the other person's apartment/room to a stranger in 5 sentences",
      'Both write down 5 things on your desk right now — compare lists',
      'Each do a dramatic reading of the last text you sent someone else (with context)',
      'Both pull out the nearest book and read the first sentence — compare',
      'Take a video of your fridge and rate each other contents',
      'Both wear something the other partner owns (shirt, hoodie, etc.) for one hour',
      'Create a 5-song playlist that represents your relationship and share it',
    ],
    deep: [
      'Share one thing about your daily life right now that you have not told them yet',
      'Ask: what is the hardest part about this distance for you this week?',
      'Describe the last time you felt truly proud of yourself — share the full story',
      'Tell each other one way the distance has made you stronger individually',
      'Share one thing you are looking forward to about your future together',
      'Ask: is there anything you need from me emotionally right now that you are not getting?',
      'Tell each other one thing you do to feel close to them when you miss them',
      'Share something you have been processing alone that you would like to process together',
      'Ask: what does love feel like to you in this relationship — how does it show up?',
      'Tell each other one fear you have about the future that you try not to think about',
      'Share one moment this week where you really wished the other was there',
      'Ask: what is something you are working on becoming, and how can I support it?',
      'Tell each other one thing you have learned about yourself from this relationship',
      'Share what home means to you — and whether it feels different now',
      'Ask: what would make you feel most loved by me this week, from this distance?',
    ],
    spicy: [
      'Send each other a voice note describing exactly what you miss most right now',
      'Write a letter to them set 10 years in the future — and share it',
      'Tell them one specific thing you are going to do the moment you see each other next',
      'Describe in detail your most romantic memory together — voice note, no typing',
      'Send a photo of something you are wearing right now that you know they like',
      'Ask: what is one thing I do that you find unexpectedly attractive?',
      'Both close your eyes for one minute and visualise being in the same room — share what you imagined',
      'Write each other a three-line poem — no apologies for it being bad',
      'Tell them the first thing you noticed about them, and the thing you notice most now',
      "Send a message that starts with: 'The thing I find impossible to forget about you is...'",
      'Both get dressed up and have a video call date — no casual clothes allowed',
      'Tell each other one moment in your relationship when you felt most desired',
      'Ask: if we had one completely free day together right now, what would you want?',
      'Share a song lyric that says something you have been wanting to tell them',
      'Send a voice note — no planning, just speak for 90 seconds about how you feel right now',
    ],
  },
} as const;

export function pickRandomFromPool<T extends string>(
  pool: readonly T[],
  avoid?: T | null
): T | null {
  if (!pool.length) return null;
  if (pool.length === 1) return pool[0];
  let next = pool[Math.floor(Math.random() * pool.length)]!;
  let guard = 0;
  while (avoid != null && next === avoid && guard++ < 48) {
    next = pool[Math.floor(Math.random() * pool.length)]!;
  }
  return next;
}

export type WeekBand = 'weekday' | 'weekend';

export function weekBandForDate(d = new Date()): WeekBand {
  return isWeekendUtc(d) ? 'weekend' : 'weekday';
}

/** Mon–Fri: light, practical, emotional — living together. */
export const WEEKDAY_LIGHT_TOGETHER: readonly string[] = [
  'Cook one simple meal together tonight — split prep and dishes evenly.',
  'Do one chore your partner usually handles — without being asked first.',
  'Five-minute check-in: “What felt heavy today?” — listen, no fixing unless they ask.',
  'Snap one photo of something that made you smile today and show it at dinner.',
  'Trade compliments: each say three specific things you noticed about the other this week.',
  'Plan tomorrow’s breakfast together in two minutes — keep it easy.',
  'Clear one small clutter spot together (a drawer, a shelf) in 10 minutes.',
  'Share one feeling you have not said out loud this week — keep it under two minutes each.',
  'Help each other with one “life admin” task (mail, calendar, groceries) for 15 minutes.',
  'Put phones in another room for the first 20 minutes after you are both home.',
  'Write a sticky-note thank-you for something small they did and hide it where they will find it.',
  'Take a 12-minute walk around the block together — no agenda, just side by side.',
  'Ask: “What would make tonight feel kinder?” — pick one tiny thing and do it.',
  'Split cooking: one chops, one stirs — finish with a high-five.',
  'Share one worry about the week ahead; the other only validates, then asks one gentle question.',
];

/** Sat–Sun: a bit more playful — still at home. */
export const WEEKEND_FUN_TOGETHER: readonly string[] = [
  'Build a blanket fort and watch one episode inside it with snacks.',
  'Dance together in the kitchen to the first song that comes on shuffle.',
  'Try a 20-minute “Chopped” challenge: pick 4 random pantry ingredients and make a snack plate.',
  'Board-game or card-game best-of-three — loser does tomorrow’s coffee run.',
  'Recreate a cheap “restaurant night” at home: candles + playlist + dress code.',
  'Film a 30-second silly commercial for “your brand as a couple.”',
  'Picnic on the floor: same blanket rules as outdoors, zero phones for 30 minutes.',
  'Each draw a portrait of the other in 3 minutes — laugh, then frame the winner on the fridge.',
  'Learn one TikTok-length dance together — perfection not required.',
  'Sunset or sunrise watch from the balcony, window, or yard — share one hope for next week.',
];

/** Mon–Fri: connection across distance — light, doable on a workday. */
export const WEEKDAY_LIGHT_LONG_DISTANCE: readonly string[] = [
  'Send one genuine voice compliment (30–45 seconds) — be specific.',
  'Snap a photo of your lunch or desk and caption what made you think of them today.',
  'Share one feeling in a voice note — “Here is something soft in me today…”',
  'Text three micro-gratitude bullets about your partner (things they did, not traits only).',
  'Plan the same 15-minute “parallel date”: same snack, same playlist start time, video optional.',
  'Each share one small win from work or study today — cheer like you are in the front row.',
  'Send a photo of the sky where you are right now — compare moods in two sentences each.',
  'Voice note: one thing you wish you could help them with if you were in the same room.',
  'Trade “rose / thorn / bud” for the day — keep each under 20 seconds.',
  'Send a meme that matches their week energy — then explain why in one line.',
  'Schedule tomorrow’s good-morning message tonight so it lands when their day starts.',
  'Share one boundary or need for the week — practical, kind, no debate required tonight.',
  'Record a 10-second “thinking of you” clip from somewhere mundane (bus stop, kitchen, etc.).',
  'Each pick a recipe you will both cook “together apart” this weekend — share ingredient lists today.',
  'Send a voice note describing the last time they made you laugh — detail wins.',
];

/** Sat–Sun: more playful energy for LD. */
export const WEEKEND_FUN_LONG_DISTANCE: readonly string[] = [
  'Same-time movie: press play together on the same film — debrief in voice notes after.',
  'Video call dress code: “nice tops, chaos bottoms” — screenshot optional.',
  'Online game night: 20 minutes of anything you both can access — winner picks next visit meal.',
  'Each send the most ridiculous selfie you can make in 60 seconds.',
  'Build a shared playlist of 5 songs for a pretend road trip — explain each pick.',
  'Virtual museum or street-view “walk” together for 15 minutes — pick the city together.',
  'Send a voice note doing your best movie-trailer voice for “this weekend in our relationship.”',
  'Both order the same category of treat delivery — rate the reveal out of 10.',
  'Write a two-sentence “alternate universe us” story and read them to each other on call.',
  'Plan a future weekend day hour-by-hour — dream logistics welcome.',
];

export function syncedDailyDareText(
  mode: CoupleMode,
  coupleCode: string | null | undefined,
  dateKey: string,
  d = new Date(),
): { text: string; band: WeekBand } {
  const band = weekBandForDate(d);
  if (!coupleCode?.trim()) {
    return {
      text: 'Pair with your partner to unlock the same dare and question every day.',
      band,
    };
  }
  const code = coupleCode.trim();
  const pool =
    mode === 'together'
      ? band === 'weekend'
        ? WEEKEND_FUN_TOGETHER
        : WEEKDAY_LIGHT_TOGETHER
      : band === 'weekend'
        ? WEEKEND_FUN_LONG_DISTANCE
        : WEEKDAY_LIGHT_LONG_DISTANCE;
  const i = permutedPoolIndex(pool.length, 'daily-dare-v2', code, dateKey);
  return { text: pool[i] ?? 'Take a small loving action for each other today.', band };
}

export function randomDare(mode: CoupleMode, tier: DareTierKind, previous?: string | null) {
  const pool = DAILY_DARES[mode][tier];
  return pickRandomFromPool(pool as readonly string[], previous ?? null);
}
