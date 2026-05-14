import { permutedPoolIndex } from '../utils/ritualDeterminism';

export const QOTD_TOPIC_IDS = [
  'relationship',
  'sex_love',
  'moral_values',
  'travel',
  'family',
  'hobbies',
  'school_work',
  'lifestyle',
  'food',
] as const;

export type QotdTopicId = (typeof QOTD_TOPIC_IDS)[number];

export type QotdTopicRow = {
  id: QotdTopicId;
  title: string;
  emoji: string;
  /** Progress ring / accents (hex). */
  accent: string;
};

export const QOTD_TOPIC_ROWS: readonly QotdTopicRow[] = [
  { id: 'relationship', title: 'Relationship', emoji: '💕', accent: '#D889A7' },
  { id: 'sex_love', title: 'Sex & Love', emoji: '💋', accent: '#C45C6A' },
  { id: 'moral_values', title: 'Moral Values', emoji: '🤝', accent: '#D4AF37' },
  { id: 'travel', title: 'Travel', emoji: '✈️', accent: '#6BA3D4' },
  { id: 'family', title: 'Family', emoji: '🏠', accent: '#7B9BD4' },
  { id: 'hobbies', title: 'Hobbies', emoji: '⚽', accent: '#9B7BD4' },
  { id: 'school_work', title: 'School & Work', emoji: '🎓', accent: '#8E7BD4' },
  { id: 'lifestyle', title: 'Lifestyle', emoji: '🏃', accent: '#D889A7' },
  { id: 'food', title: 'Food', emoji: '🍕', accent: '#D4705A' },
];

/** UI grouping — questions still live per topic in `POOLS`. */
export const QOTD_TOPIC_SECTIONS: readonly { title: string; topicIds: readonly QotdTopicId[] }[] = [
  { title: 'Connection & values', topicIds: ['relationship', 'sex_love', 'moral_values', 'family'] },
  { title: 'Life, work & fun', topicIds: ['travel', 'hobbies', 'school_work', 'lifestyle', 'food'] },
] as const;

const POOLS = {
  relationship: [
    'What is one small thing your partner did recently that made you feel loved?',
    'When do you feel most emotionally safe with your partner?',
    'What is a habit you would like us to build together this month?',
    'How do you prefer to receive an apology?',
    'What is one topic you want us to talk about more openly?',
    'What does “quality time” look like for you — be specific.',
    'What is a boundary you are glad we respect?',
    'What is one dream you want us to chase together in the next year?',
    'How do you know when you are overwhelmed — what signs should I watch for?',
    'What is one way we communicate really well?',
    'What is one way we could communicate better?',
    'What is your favourite memory of us from the last 90 days?',
    'What is something you appreciate about how we handle disagreements?',
    'What is one fear you have about the future that you want me to understand?',
    'What does “being a team” mean to you in everyday life?',
    'What is one appreciation you have not said out loud lately that you want me to hear?',
    'When you picture us five years from now, what is one thing you hope is still true?',
  ],
  sex_love: [
    'What makes you feel desired that is not about physical appearance?',
    'What is one thing I do that makes intimacy feel easier for you?',
    'How do you like to be flirted with during a busy week?',
    'What is a romantic gesture that actually lands for you?',
    'What is something intimate you would like more of — emotional or physical?',
    'What is a “green flag” moment you have had with me recently?',
    'How do you want to be approached when you are not in the mood?',
    'What is a compliment about your body or presence that you never get tired of?',
    'What is one boundary around intimacy that matters to you?',
    'What is a song that feels like us in a romantic way?',
    'What is something new you would be curious to try together when we both feel ready?',
    'What helps you feel close to me when we are apart?',
    'What is your favourite way to reconnect after a stressful day?',
    'What is one thing you want me to know about your love language this week?',
    'What does aftercare look like for you — even for small moments?',
  ],
  moral_values: [
    'What is a value you will never compromise on in a relationship?',
    'What is a lesson from your family that you want to keep in our life?',
    'How do you think about honesty when the truth might hurt?',
    'What does fairness mean to you when we disagree?',
    'What is a cause or issue you care about that you want me to understand better?',
    'How important is forgiveness to you — and what helps you forgive?',
    'What role does gratitude play in your daily life?',
    'What is something you changed your mind about as you got older?',
    'How do you want us to handle money disagreements?',
    'What does integrity look like in small everyday choices?',
    'What is a tradition you want us to keep or create?',
    'How do you feel about lending money to friends or family as a couple?',
    'What is a line you never want us to cross with each other in conflict?',
    'What does “doing the right thing” mean when no one is watching?',
    'What is one way we can live our values more visibly this month?',
  ],
  travel: [
    'What is the next trip you want us to plan together?',
    'City break or nature trip — what is your ideal mix?',
    'What is a travel memory you still think about?',
    'What is your airport or travel day personality?',
    'What is one place you are nervous to visit but still curious about?',
    'What snacks must always be in the travel bag?',
    'What is your favourite travel photo of us (or solo) and why?',
    'How do you like to plan: spreadsheet, vibes, or a bit of both?',
    'What is a “bucket list” experience you want with me?',
    'What is your ideal pace on vacation: packed schedule or slow mornings?',
    'What is a culture or cuisine you want us to explore together?',
    'What is your favourite season to travel in?',
    'What is one travel habit you want us to improve as a team?',
    'Window or aisle — and does it matter on long flights with me?',
    'What is a small weekend getaway that would feel refreshing this month?',
  ],
  family: [
    'What does “family” mean to you beyond biology?',
    'What is one boundary with extended family that matters to you?',
    'What holiday traditions do you want us to keep or blend?',
    'How do you like to be supported before a family gathering?',
    'What is something you wish I understood about your family dynamic?',
    'What role do you want friends to play in our life versus family?',
    'How should we handle unsolicited advice from relatives?',
    'What is a childhood memory that shaped how you show love?',
    'What is one way you want us to show up for each other’s families?',
    'How do you feel about kids (or more kids) — what is on your mind lately?',
    'What is a family recipe or dish that feels like home to you?',
    'What is something your parents did that you want us to repeat?',
    'What is something you want us to do differently from your upbringing?',
    'How do you recharge after intense family time?',
    'What is a family goal you want us to work toward in the next year?',
  ],
  hobbies: [
    'What hobby makes you lose track of time?',
    'What is something you want us to try as a hobby together?',
    'What is a hobby you love that you think I underestimate?',
    'What is a class or workshop you would sign us up for on a whim?',
    'What is your “solo recharge” hobby versus “together” hobby?',
    'What is a sport or game you want to play with me more often?',
    'What is a creative project you have been putting off?',
    'What hobby gear do you secretly want but feel guilty buying?',
    'What is a fandom or interest you want me to learn more about?',
    'What is a low-cost hobby date night you would enjoy?',
    'What is something you are bad at but enjoy anyway?',
    'What hobby did you love as a kid that you miss?',
    'What is a hobby boundary you need (time, space, mess)?',
    'What is a hobby win you are proud of recently?',
    'What is one hobby goal for the next three months?',
  ],
  school_work: [
    'What is stressing you most about work or school right now?',
    'What does support look like on a heavy deadline week?',
    'What is a career dream you want me to cheer for?',
    'How do you like to celebrate professional wins — big or small?',
    'What is one work habit you admire in yourself?',
    'What is one work habit you want to change with my help?',
    'How do you want me to respond when you vent about work?',
    'What is a skill you are learning that excites you?',
    'What is your ideal work-from-home boundary with me around?',
    'What is a compliment about your competence that you remember?',
    'What is something you learned recently that changed how you think?',
    'What is a “red flag” work situation you want us to watch for together?',
    'What is your relationship with rest during busy seasons?',
    'What is one way we can protect date night during crunch time?',
    'What is a mentor or teacher who shaped you — what did they teach?',
  ],
  lifestyle: [
    'What does a healthy week look like for you: sleep, movement, food?',
    'What is one lifestyle upgrade you want for our home?',
    'How do you want us to split morning routines?',
    'What is your relationship with caffeine, screens, and wind-down?',
    'What is a small wellness habit you want us to try together?',
    'What is your ideal Sunday rhythm?',
    'What is clutter or chaos that quietly stresses you out?',
    'What is a routine that makes you feel grounded?',
    'What is a lifestyle value: minimalism, comfort, adventure, or something else?',
    'What is one thing we could automate or simplify in our shared life?',
    'How important is “aesthetic” home vibe to you versus pure function?',
    'What is a boundary around social life you want this month?',
    'What is a lifestyle goal for the next season?',
    'What helps you feel rested — not just “not tired”?',
    'What is a playlist or ritual that signals “we are home” for you?',
  ],
  food: [
    'What is your ultimate comfort meal?',
    'What is a cuisine you want us to explore next?',
    'What is your favourite thing I cook (or order) for you?',
    'Sweet or savoury for late-night snacks — pick a hill to die on.',
    'What is a food memory from dating that you still love?',
    'What is a restaurant you want us to dress up for?',
    'What is a “lazy dinner” that still feels special?',
    'What ingredient should we always have in the fridge?',
    'What is a food you hated as a kid but love now?',
    'What is a cooking skill you want us to learn together?',
    'What is your stance on pineapple on pizza — and can we stay together?',
    'What is a drink order that feels like “you”?',
    'What is a food tradition you want to start?',
    'What is your ideal breakfast-in-bed order?',
    'What is a dessert that should be illegal because it is too good?',
    'What is a meal that always feels like “us”?',
    'If we could only cook one cuisine for a month, what would you pick?',
  ],
} as const satisfies Record<QotdTopicId, readonly string[]>;

export function isValidQotdTopicId(id: string): id is QotdTopicId {
  return (QOTD_TOPIC_IDS as readonly string[]).includes(id);
}

export function topicPoolLength(topicId: string): number {
  if (!isValidQotdTopicId(topicId)) return 1;
  return POOLS[topicId].length;
}

/** Example prompts from that topic’s pool (for browsing on the topic picker). */
export function topicQuestionSamples(topicId: string, max = 3): string[] {
  if (!isValidQotdTopicId(topicId)) return [];
  const pool = POOLS[topicId];
  const n = Math.max(0, Math.min(max, pool.length));
  return pool.slice(0, n);
}

/**
 * Same question text for both partners when `syncKey` (usually couple code), `topicId`, and UTC
 * `dateKey` match. Use `syncKey = uid` when not paired yet so you still see a stable daily prompt.
 */
export function syncedTopicQuestion(topicId: string, syncKey: string, dateKey: string): string {
  if (!isValidQotdTopicId(topicId)) {
    return 'Pick a topic to unlock today’s question.';
  }
  const pool = POOLS[topicId];
  const key = syncKey.trim() || 'local';
  const i = permutedPoolIndex(pool.length, `qotd-topic|${topicId}`, key, dateKey);
  return pool[i] ?? pool[0]!;
}

export function topicRowById(id: string): QotdTopicRow | undefined {
  return QOTD_TOPIC_ROWS.find((r) => r.id === id);
}
