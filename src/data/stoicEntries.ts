// 30-day Stoic rotation for the Spirit page.
// Themes cycle deliberately: Control → Duty → Adversity → Time → Restraint →
// Service → Courage → Gratitude → Perspective → Reset (repeat)
// Each entry: theme, quote, author, work, reflection (2-3 sentences),
// meditation (one original line), action, journal.

export type StoicEntry = {
  day: number        // 1–30
  theme: string
  quote: string
  author: string
  work?: string
  reflection: string
  meditation: string
  action: string
  journal: string
  tags: string[]     // god slugs this resonates with most; [] = universal
}

export const STOIC_ENTRIES: StoicEntry[] = [

  // ── Day 1 — Control ────────────────────────────────────────────────────────
  {
    day: 1,
    theme: 'Control',
    quote: 'Some things are up to us and some are not.',
    author: 'Epictetus',
    work: 'Enchiridion',
    reflection: 'Most frustration traces back to a blurry line between what is yours and what is not. Reputation, outcomes, other people\'s moods, the timing of things — these sit outside your full command. Effort, judgment, conduct, and how you meet the moment — these are yours. Draw the line cleanly, and the weight shifts.',
    meditation: 'Return your energy to what is actually yours today.',
    action: 'Before you react to anything today, ask: is this within my control? If not, release the opinion about it.',
    journal: 'What am I carrying right now that was never mine to control?',
    tags: [],
  },

  // ── Day 2 — Duty ──────────────────────────────────────────────────────────
  {
    day: 2,
    theme: 'Duty',
    quote: 'Waste no more time arguing what a good man should be. Be one.',
    author: 'Marcus Aurelius',
    work: 'Meditations',
    reflection: 'The gap between knowing and doing is where most character gets lost. The man who lectures his kids about discipline and then flinches from his own has already lost the argument. The question is never what the right thing is — that is usually clear. The question is whether you do it before it becomes convenient.',
    meditation: 'Today\'s duty does not need a reason. It needs you.',
    action: 'Do the one thing you have been postponing because you didn\'t feel like it. Do it before noon.',
    journal: 'What duty have I been framing as optional when it is not?',
    tags: ['hercules', 'atlas'],
  },

  // ── Day 3 — Adversity ─────────────────────────────────────────────────────
  {
    day: 3,
    theme: 'Adversity',
    quote: 'The impediment to action advances action. What stands in the way becomes the way.',
    author: 'Marcus Aurelius',
    work: 'Meditations',
    reflection: 'A disrupted plan, a hard conversation, a body that won\'t cooperate, a day that goes sideways before 8am — none of it is proof that the path is wrong. Stoicism doesn\'t promise smooth conditions. It trains you to be more useful under rough ones. The obstacle is not a detour from the work. Often it is the work.',
    meditation: 'Hard days are not evidence that the path is wrong.',
    action: 'Name the current obstacle in your life. Write down one small, direct action you can take on it today.',
    journal: 'Am I treating this difficulty as an interruption, or as something to be met?',
    tags: ['hercules', 'atlas', 'ares'],
  },

  // ── Day 4 — Time ──────────────────────────────────────────────────────────
  {
    day: 4,
    theme: 'Time',
    quote: 'It is not that we have a short time to live, but that we waste much of it.',
    author: 'Seneca',
    work: 'On the Shortness of Life',
    reflection: 'Life shrinks or expands based on how seriously you treat each day. Most time isn\'t lost to catastrophe — it leaks through distraction, hesitation, and vague living. A man who treats today as disposable is not saving himself for something better. He is simply spending less of his life on purpose.',
    meditation: 'You are not managing time. You are spending life.',
    action: 'Identify the single highest-value thing you can do today. Protect one hour for it before anything else claims it.',
    journal: 'If today were all I clearly had, what would become more important — and what would become irrelevant?',
    tags: ['chronos'],
  },

  // ── Day 5 — Restraint ─────────────────────────────────────────────────────
  {
    day: 5,
    theme: 'Restraint',
    quote: 'Most powerful is he who has himself in his own power.',
    author: 'Seneca',
    work: 'Letters',
    reflection: 'Restraint is not weakness dressed up. It is self-command — choosing what you consume, how you speak, what you let into your attention, and when you act. A man who lets every appetite cast the deciding vote has no real freedom, only the illusion of it. The Stoics understood that mastery over yourself is the precondition for mastery of anything else.',
    meditation: 'Freedom begins where appetite stops making the decisions.',
    action: 'Remove one unnecessary comfort or distraction for the day. Not as punishment — as practice.',
    journal: 'Where is something other than my judgment currently running my day?',
    tags: ['adonis'],
  },

  // ── Day 6 — Service ───────────────────────────────────────────────────────
  {
    day: 6,
    theme: 'Service',
    quote: 'Wherever there is a human being, there is an opportunity for kindness.',
    author: 'Seneca',
    work: 'Letters',
    reflection: 'Strength that stays private and never reaches the people near you has missed its point. The Stoics were clear: a man who masters himself should become steadier, fairer, and more useful to others — not more self-contained. The household, the friendship, the colleague who is struggling — these are where philosophy proves itself or doesn\'t.',
    meditation: 'Discipline should make you safer for the people around you, not more distant from them.',
    action: 'Do one concrete thing for someone near you today — not because they asked, and not because you feel like it.',
    journal: 'Is my inner work producing more patience and reliability for the people around me?',
    tags: [],
  },

  // ── Day 7 — Courage ───────────────────────────────────────────────────────
  {
    day: 7,
    theme: 'Courage',
    quote: 'He who is brave is free.',
    author: 'Seneca',
    work: 'Letters',
    reflection: 'Courage is not the absence of fear — it is refusing to let fear write your values. The hard conversation you\'ve been avoiding, the boundary you haven\'t held, the standard you\'ve been too tired to enforce — these are not small things. Fear of friction is the thing that quietly shrinks a man\'s life from the inside.',
    meditation: 'The thing you\'ve been avoiding is the thing that needs you most.',
    action: 'Have the conversation or take the action you have been putting off because it is uncomfortable.',
    journal: 'Where is fear quietly making my decisions for me?',
    tags: ['ares'],
  },

  // ── Day 8 — Gratitude ─────────────────────────────────────────────────────
  {
    day: 8,
    theme: 'Gratitude',
    quote: 'When you arise in the morning, think of what a privilege it is to be alive, to think, to enjoy, to love.',
    author: 'Marcus Aurelius',
    work: 'Meditations',
    reflection: 'Stoic gratitude is not optimism theater. It is a practice of accurate accounting — noticing what is actually present before cataloguing what is absent or wrong. The man who is short on sleep, behind on goals, and carrying a full load still has things worth noting. Ingratitude is often just inattention.',
    meditation: 'What you take for granted today was once something you hoped for.',
    action: 'Name three things that are actually going well right now. Say them out loud or write them down — no qualifications.',
    journal: 'What am I failing to notice because I\'ve been focused on what\'s missing?',
    tags: [],
  },

  // ── Day 9 — Perspective ───────────────────────────────────────────────────
  {
    day: 9,
    theme: 'Perspective',
    quote: 'Everything we hear is opinion, not fact. Everything we see is perspective, not truth.',
    author: 'Marcus Aurelius',
    work: 'Meditations',
    reflection: 'The story you tell yourself about an event is almost never the only story available. The traffic, the tone in an email, the look someone gave you — these are raw material, and your mind finishes the job. Most of what makes a day heavy is not the day itself but the interpretation you chose without noticing you chose it.',
    meditation: 'Your first thought is not your final truth.',
    action: 'When something irritates or discourages you today, pause and ask: what is actually happening, separate from what I am adding to it?',
    journal: 'What story am I telling myself about a current situation that may not be accurate?',
    tags: [],
  },

  // ── Day 10 — Reset ────────────────────────────────────────────────────────
  {
    day: 10,
    theme: 'Reset',
    quote: 'Begin at once to live, and count each separate day as a separate life.',
    author: 'Seneca',
    work: 'Letters',
    reflection: 'Yesterday\'s drift is real, but it is not a contract. A man who lost the week to distraction, poor choices, or simple exhaustion does not need a new month to correct course — he needs today. Each day offers a clean first hour, a clean first decision. The reset is always available. Most people just wait for a better moment to use it.',
    meditation: 'You do not need a new season to return to your standard.',
    action: 'Pick one thing you let slide recently and re-enter it today. Not perfectly — just honestly.',
    journal: 'What am I waiting for before I start living the way I intend to?',
    tags: [],
  },

  // ── Day 11 — Control ──────────────────────────────────────────────────────
  {
    day: 11,
    theme: 'Control',
    quote: 'Today I escaped anxiety. Or no, I discarded it, because it was within me — in my own perceptions.',
    author: 'Marcus Aurelius',
    work: 'Meditations',
    reflection: 'Anxiety usually lives in the gap between what is happening and what you insist should happen instead. The Stoic move is not to suppress the feeling — it is to examine the judgment underneath it. Often the distress survives not because the situation demands it, but because the mind keeps feeding the case against reality.',
    meditation: 'Calm is not passivity. Calm is governed force.',
    action: 'Name one anxiety you\'re carrying. Identify what specific judgment underneath it you could revise.',
    journal: 'What am I resisting about my current reality that I could accept without giving up?',
    tags: [],
  },

  // ── Day 12 — Duty ─────────────────────────────────────────────────────────
  {
    day: 12,
    theme: 'Duty',
    quote: 'Be tolerant with others and strict with yourself.',
    author: 'Marcus Aurelius',
    work: 'Meditations',
    reflection: 'The standard you hold for yourself and the patience you extend to others are both expressions of character. Harshness toward others often masks a lack of self-discipline — a man who cannot manage himself tends to manage everyone else instead. Strictness with yourself and tolerance for others is the mature form. It is harder, and it is the right direction.',
    meditation: 'The people near you deserve your patience more than your performance.',
    action: 'Today, hold yourself to a higher standard in one area and extend more patience than usual to someone in your household or team.',
    journal: 'Where am I harder on others than I am on myself?',
    tags: [],
  },

  // ── Day 13 — Adversity ────────────────────────────────────────────────────
  {
    day: 13,
    theme: 'Adversity',
    quote: 'A gem cannot be polished without friction, nor a man perfected without trials.',
    author: 'Seneca',
    work: 'Letters',
    reflection: 'The rough patch you are in is not proof of failure. It is the environment where real formation happens. Easy seasons maintain what already exists. Hard ones build what doesn\'t yet. This doesn\'t require enjoying the difficulty — only refusing to waste it by making your suffering louder than your effort.',
    meditation: 'The friction is part of the finishing.',
    action: 'Find one way to engage the difficulty in front of you more directly today, rather than managing around it.',
    journal: 'What is the current difficulty teaching me about where my discipline is real and where it is assumed?',
    tags: ['hercules', 'atlas'],
  },

  // ── Day 14 — Time ─────────────────────────────────────────────────────────
  {
    day: 14,
    theme: 'Time',
    quote: 'Do not act as if you were going to live ten thousand years.',
    author: 'Marcus Aurelius',
    work: 'Meditations',
    reflection: 'One of the most reliable human tendencies is to treat today as practice for the life you intend to live later. You will be more disciplined next month, more present next year, more serious when things settle down. But the settling down never arrives on schedule, and the habits you are building now are the ones that will actually run your life.',
    meditation: 'Today is not rehearsal.',
    action: 'Identify one thing you\'ve been postponing until circumstances improve. Take one step on it today, in the circumstances you have.',
    journal: 'What am I saving my seriousness for — and what is the actual cost of that delay?',
    tags: ['chronos'],
  },

  // ── Day 15 — Restraint ────────────────────────────────────────────────────
  {
    day: 15,
    theme: 'Restraint',
    quote: 'Wealth consists not in having great possessions, but in having few wants.',
    author: 'Epictetus',
    work: 'Discourses',
    reflection: 'The man who needs a great deal from his day in order to feel steady is not a free man. Every unnecessary appetite creates a dependency, and dependencies are leverage points for anxiety. Simplicity is not poverty — it is clarity. Fewer requirements means steadier footing when the day does not cooperate.',
    meditation: 'The more you need the day to go a certain way, the more the day owns you.',
    action: 'Choose a small deliberate deprivation today — a meal, a comfort, a distraction. Not as punishment, but to practice needing less.',
    journal: 'What do I treat as a necessity that is actually a preference I\'ve stopped questioning?',
    tags: ['adonis', 'chronos'],
  },

  // ── Day 16 — Service ──────────────────────────────────────────────────────
  {
    day: 16,
    theme: 'Service',
    quote: 'No one can live happily who has regard only to himself.',
    author: 'Seneca',
    work: 'Letters',
    reflection: 'The strongest version of self-discipline is not self-containment — it is becoming reliably useful. A man who builds himself into something harder to shake does not do it for ego. He does it so that the people depending on him can actually depend on him. The purpose of inner strength is outer reliability.',
    meditation: 'Build yourself into something your family can lean on.',
    action: 'Do one thing today that makes someone else\'s load lighter without telling them about it.',
    journal: 'Is my discipline producing more reliability and warmth for the people near me, or just more self-focus?',
    tags: [],
  },

  // ── Day 17 — Courage ──────────────────────────────────────────────────────
  {
    day: 17,
    theme: 'Courage',
    quote: 'Difficulty shows what men are.',
    author: 'Epictetus',
    work: 'Discourses',
    reflection: 'Ease is not the proving ground. Character shows up under pressure — when you are tired, behind, frustrated, or afraid — and it shows in small moments more than large ones. The man who is steady in traffic and honest in a difficult conversation is doing more real work than the man who performs well in comfortable conditions only.',
    meditation: 'Let the hard moment show what your training has actually built.',
    action: 'Before the day ends, do one thing that requires more honesty or courage than is comfortable.',
    journal: 'Where am I choosing the version of things that costs me least?',
    tags: ['ares', 'hercules'],
  },

  // ── Day 18 — Gratitude ────────────────────────────────────────────────────
  {
    day: 18,
    theme: 'Gratitude',
    quote: 'True happiness is to enjoy the present without anxious dependence upon the future.',
    author: 'Seneca',
    work: 'Letters',
    reflection: 'There is a version of forward-thinking that is actually just refusal to inhabit the present. Planning is necessary. But deferring all satisfaction to a future state — a finished goal, a different season, a better version of things — is a way of missing the life you are already in. The Stoics were not naive about the future. They were suspicious of happiness on layaway.',
    meditation: 'Stop waiting for different conditions to begin appreciating what is already here.',
    action: 'Find one ordinary thing in your day — a meal, a conversation, a few quiet minutes — and give it your full attention.',
    journal: 'What in my current life have I stopped seeing because it has become routine?',
    tags: [],
  },

  // ── Day 19 — Perspective ──────────────────────────────────────────────────
  {
    day: 19,
    theme: 'Perspective',
    quote: 'How much more grievous are the consequences of anger than the causes of it.',
    author: 'Marcus Aurelius',
    work: 'Meditations',
    reflection: 'Anger moves fast and costs slowly. The bill arrives after the heat fades — in the relationship you strained, the trust you eroded, the model you put in front of your kids. The thing that triggered the anger is usually far smaller than its aftermath. A man with trained perspective holds the cause and the consequence in view at the same time before he moves.',
    meditation: 'Measure the reaction against the cause before it leaves your mouth.',
    action: 'When irritation rises today, pause for three seconds and ask: will my response help the situation or only discharge my discomfort?',
    journal: 'Where has a quick reaction cost me something I would not have chosen to spend?',
    tags: [],
  },

  // ── Day 20 — Reset ────────────────────────────────────────────────────────
  {
    day: 20,
    theme: 'Reset',
    quote: 'We should every night call ourselves to an account.',
    author: 'Seneca',
    work: 'Letters',
    reflection: 'An evening review is not self-punishment — it is calibration. Where did you act well? Where did you drift, react, or avoid? The man who ends each day with honest accounting can correct course daily instead of quarterly. Small corrections made often are more powerful than grand resets made occasionally.',
    meditation: 'Spend today in a way that can stand review tonight.',
    action: 'Tonight, take five minutes to review the day honestly: one thing done well, one thing to correct. Write it down.',
    journal: 'What would I do differently today if I knew I would review it honestly tonight?',
    tags: [],
  },

  // ── Day 21 — Control ──────────────────────────────────────────────────────
  {
    day: 21,
    theme: 'Control',
    quote: 'Any person capable of angering you becomes your master.',
    author: 'Epictetus',
    work: 'Discourses',
    reflection: 'Every time someone\'s behavior, opinion, or presence derails your composure, they have effectively taken the wheel. You do not need to be emotionless — you need to be ungovernable by other people\'s choices. The harder-to-shake you become, the more your responses belong to you and not to whoever provoked them.',
    meditation: 'Your freedom begins where your blame ends.',
    action: 'Today, notice any moment someone triggers a strong reaction in you. Pause before responding. Choose the response instead of releasing it.',
    journal: 'Who or what has the most consistent power to pull me off my center — and why have I let that continue?',
    tags: [],
  },

  // ── Day 22 — Duty ─────────────────────────────────────────────────────────
  {
    day: 22,
    theme: 'Duty',
    quote: 'First say to yourself what you would be, and then do what you have to do.',
    author: 'Epictetus',
    work: 'Discourses',
    reflection: 'The man you intend to be and the man your daily choices are building are not always the same man. The gap between intention and action is where most character work actually lives. Knowing what kind of father, husband, or person you want to be is not enough on its own. It has to reach the specific decision in front of you.',
    meditation: 'The man you are becoming is visible in what you do before anyone is watching.',
    action: 'Write down in one sentence the kind of man you are trying to be. Check one decision you make today against it.',
    journal: 'Are my daily actions building the man I say I want to become?',
    tags: ['adonis', 'hercules'],
  },

  // ── Day 23 — Adversity ────────────────────────────────────────────────────
  {
    day: 23,
    theme: 'Adversity',
    quote: 'To bear trials with a calm mind robs misfortune of its strength.',
    author: 'Seneca',
    work: 'Letters',
    reflection: 'Misfortune feeds on drama. When you narrate the hardship, catastrophize the outcome, and broadcast your suffering, you amplify what was already difficult. The trained response is different: carry the weight, skip the commentary, keep moving. Equanimity does not make the difficulty smaller — it keeps you larger than it.',
    meditation: 'The weight is lighter when resentment leaves it.',
    action: 'If you are in a difficult stretch right now, choose to speak about it to one fewer person than you normally would. Carry more of it quietly.',
    journal: 'Am I meeting this difficulty, or am I mainly narrating it?',
    tags: ['atlas'],
  },

  // ── Day 24 — Time ─────────────────────────────────────────────────────────
  {
    day: 24,
    theme: 'Time',
    quote: 'While we wait for life, life passes.',
    author: 'Seneca',
    work: 'Letters',
    reflection: 'The large life you intend is assembled in ordinary days. There is no block of time arriving later when you will finally have the conditions right to live the way you mean to. The man who trains when tired, shows up when distracted, and holds his standards under imperfect conditions is already living that life. Everyone else is rehearsing it.',
    meditation: 'The ordinary day in front of you is your real life, not a waiting room for it.',
    action: 'Identify one thing you keep putting off until life gets less busy. Schedule it for this week, in the schedule you actually have.',
    journal: 'Am I participating in my actual life, or am I waiting for a better version of it to begin?',
    tags: ['chronos'],
  },

  // ── Day 25 — Restraint ────────────────────────────────────────────────────
  {
    day: 25,
    theme: 'Restraint',
    quote: 'If you accomplish something good with hard work, the labor passes quickly, but the good endures.',
    author: 'Musonius Rufus',
    reflection: 'The shortcut is almost always the longer road. The easy meal, the skipped session, the conversation avoided — each compromise is small, but each one is also a vote for the easier self. What is done with discipline outlasts the discomfort of doing it. What is avoided because it was hard tends to return, larger.',
    meditation: 'Choose the harder right over the easier drift.',
    action: 'Do one thing today the difficult way when an easier alternative was available — the workout, the conversation, the early start.',
    journal: 'Where am I choosing convenience in a place where discipline would serve me better?',
    tags: ['adonis', 'hercules'],
  },

  // ── Day 26 — Service ──────────────────────────────────────────────────────
  {
    day: 26,
    theme: 'Service',
    quote: 'Be tolerant with others and strict with yourself.',
    author: 'Marcus Aurelius',
    work: 'Meditations',
    reflection: 'The man who is demanding of himself but patient with others is practicing a mature form of self-command. Children, spouses, colleagues — they are not failing you when they are imperfect. They are being human. Holding yourself to a higher internal standard while extending genuine patience outward is harder than any workout. It is also more important.',
    meditation: 'Strength is most visible when it makes other people feel safe.',
    action: 'Pick one person you have been impatient with recently. Offer them something they didn\'t ask for: your full attention, your patience, your benefit of the doubt.',
    journal: 'Is the strictness I apply to myself making me better for the people around me, or just harder to be around?',
    tags: [],
  },

  // ── Day 27 — Courage ──────────────────────────────────────────────────────
  {
    day: 27,
    theme: 'Courage',
    quote: 'Circumstances do not make the man. They only reveal him to himself.',
    author: 'Epictetus',
    work: 'Discourses',
    reflection: 'You do not know who you are in comfortable conditions. Comfort is a holding pattern. Who you are under pressure, under fatigue, under criticism, under failure — that is the actual reading. This is not a reason to seek suffering. It is a reason to stop avoiding the situations that reveal what still needs work.',
    meditation: 'The hard moment is not interrupting your formation. It is your formation.',
    action: 'Face one thing today that you have been avoiding because it is uncomfortable or uncertain.',
    journal: 'What have recent difficult circumstances revealed to me about myself — honestly?',
    tags: ['ares', 'hercules'],
  },

  // ── Day 28 — Gratitude ────────────────────────────────────────────────────
  {
    day: 28,
    theme: 'Gratitude',
    quote: 'Receive without pride, let go without attachment.',
    author: 'Marcus Aurelius',
    work: 'Meditations',
    reflection: 'Things come and go — strength, health, relationships, money, routines, seasons. The Stoic practice is to hold them with open hands. Not indifference — genuine care. But not the white-knuckled grip that turns every loss into catastrophe. Gratitude for what is present and equanimity about what changes are two sides of the same posture.',
    meditation: 'Be grateful for what is here without making your peace conditional on it staying.',
    action: 'Briefly contemplate losing one thing you currently take for granted — your health, your training ability, one of your close relationships. Let it produce gratitude, not anxiety.',
    journal: 'What in my life am I holding so tightly that losing it would destroy my equilibrium?',
    tags: [],
  },

  // ── Day 29 — Perspective ──────────────────────────────────────────────────
  {
    day: 29,
    theme: 'Perspective',
    quote: 'We are more often frightened than hurt.',
    author: 'Seneca',
    work: 'Letters',
    reflection: 'Most of the suffering that happens to a man happens in his imagination before reality has delivered a verdict. The presentation you dread, the conversation you fear, the outcome you can\'t stop rehearsing — these consume real energy before the event, and the event itself is usually lighter than the preview. The Stoics called this pre-suffering, and they treated it as unnecessary tax.',
    meditation: 'The disaster you are preparing for has usually already passed by the time you finish worrying about it.',
    action: 'Name one thing you are dreading. Ask honestly: what is the most realistic version of this outcome? Prepare for that, not the worst-case version.',
    journal: 'How much energy am I spending on suffering that has not actually arrived?',
    tags: [],
  },

  // ── Day 30 — Reset ────────────────────────────────────────────────────────
  {
    day: 30,
    theme: 'Reset',
    quote: 'The perfection of character is this: to live each day as if it were your last, without frenzy, without apathy, without pretense.',
    author: 'Marcus Aurelius',
    work: 'Meditations',
    reflection: 'A month is thirty choices of how to meet a day. Not thirty opportunities to be perfect — thirty opportunities to be honest and deliberate. If this month had more drift than intention, that is information, not a verdict. The next day is always a clean account. The standard does not change because you missed it. You return to it.',
    meditation: 'Your standard is still there. Return to it.',
    action: 'Spend five minutes reviewing this past month honestly — where you showed up, where you didn\'t. Write down one concrete commitment for the month ahead.',
    journal: 'What kind of man was I building this month — and is that the man I intend to keep building?',
    tags: [],
  },
]

// ── Lookup helpers ─────────────────────────────────────────────────────────────

/** Returns the entry for the current day of the month (1-indexed, wraps at 30) */
export function getTodaysStoicEntry(): StoicEntry {
  const dayOfMonth = new Date().getDate() // 1–31
  const index = ((dayOfMonth - 1) % 30)  // 0–29
  return STOIC_ENTRIES[index]
}

/** Returns the entry for a given day-of-month (1-indexed) */
export function getStoicEntryForDay(dayOfMonth: number): StoicEntry {
  const index = ((dayOfMonth - 1) % 30)
  return STOIC_ENTRIES[index]
}
