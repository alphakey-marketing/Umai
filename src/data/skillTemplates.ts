import type { SkillTemplate } from '../types';

export const SKILL_TEMPLATES: SkillTemplate[] = [
  {
    id: 'tpl_badminton',
    name: 'Badminton',
    category: 'Sport',
    icon: '🏸',
    description: 'Build court mastery from footwork to smash power.',
    sub_skills: [
      {
        name: 'Footwork',
        description: 'Court movement and split-step timing.',
        drills: [
          { name: 'Shadow Footwork', description: 'Move to all 6 corners of the court without a shuttle. Focus on split-step and recovery.', duration_secs: 300, target_reps: 5, difficulty: 2 },
          { name: 'T-Position Recovery', description: 'After each imaginary shot, return to T and freeze before moving again.', duration_secs: 180, target_reps: 3, difficulty: 3 },
          { name: 'Split-Step Timing', description: 'Partner calls a direction; you split-step and lunge before the call ends.', duration_secs: 120, target_reps: 20, difficulty: 3 },
        ],
      },
      {
        name: 'Smash',
        description: 'Power, angle, and consistency in attacking shots.',
        drills: [
          { name: 'Jump Smash Shadow', description: 'Jump and execute smash motion without shuttle. Focus on wrist snap at peak.', duration_secs: 240, target_reps: 4, difficulty: 3 },
          { name: 'Feeder Smash Accuracy', description: 'Partner feeds high clears. Smash to alternating corners.', duration_secs: 0, target_reps: 20, difficulty: 4 },
        ],
      },
      {
        name: 'Net Play',
        description: 'Deceptive net shots and fast net kills.',
        drills: [
          { name: 'Net Kill Reaction', description: 'Partner feeds loose net shots. Kill flat and fast.', duration_secs: 180, target_reps: 15, difficulty: 3 },
          { name: 'Tight Net Lift', description: 'Play a tight net shot, then lift to deep corner — alternate sides.', duration_secs: 0, target_reps: 15, difficulty: 3 },
        ],
      },
      {
        name: 'Serve',
        description: 'Consistent and deceptive serve execution.',
        drills: [
          { name: 'Low Serve Consistency', description: 'Serve low and flat over net. Count how many land in the front service box.', duration_secs: 0, target_reps: 30, difficulty: 2 },
          { name: 'Flick Serve Disguise', description: 'Mix low and flick serves. Same motion until last moment.', duration_secs: 0, target_reps: 20, difficulty: 4 },
        ],
      },
    ],
  },
  {
    id: 'tpl_singing',
    name: 'Singing',
    category: 'Music',
    icon: '🎤',
    description: 'Develop breath, pitch, tone, and performance confidence.',
    sub_skills: [
      {
        name: 'Breath Control',
        description: 'Diaphragmatic breathing and sustained airflow.',
        drills: [
          { name: 'Diaphragm Expansion', description: 'Breathe in for 4 counts, hold 4, release for 8. Feel belly expand, not chest.', duration_secs: 300, target_reps: 10, difficulty: 1 },
          { name: 'Sustained Note Hold', description: 'Sing a comfortable note and hold as long as possible on one breath. Log duration.', duration_secs: 0, target_reps: 10, difficulty: 2 },
        ],
      },
      {
        name: 'Pitch Accuracy',
        description: 'Match pitch precisely and navigate intervals.',
        drills: [
          { name: 'Scale Walking', description: 'Sing major scale up and down slowly with a piano app. Match each note before moving.', duration_secs: 300, target_reps: 5, difficulty: 2 },
          { name: 'Interval Jump Drills', description: 'Sing intervals (3rd, 5th, octave) from a root note. Use a tuner app to verify.', duration_secs: 600, target_reps: 10, difficulty: 3 },
        ],
      },
      {
        name: 'Tone & Resonance',
        description: 'Shape vowels and feel chest/head voice placement.',
        drills: [
          { name: 'Vowel Shaping', description: 'Sing a held note through A-E-I-O-U, keeping tone consistent across vowels.', duration_secs: 300, target_reps: 5, difficulty: 2 },
          { name: 'Chest/Head Transition', description: 'Sing a scale that crosses your break point. Transition smoothly without cracking.', duration_secs: 300, target_reps: 6, difficulty: 4 },
        ],
      },
      {
        name: 'Song Application',
        description: 'Apply technique to real material.',
        drills: [
          { name: 'Phrase Isolation', description: 'Pick one hard phrase. Sing it slowly 5×, then at speed 5×. Record yourself.', duration_secs: 0, target_reps: 10, difficulty: 3 },
          { name: 'Full Performance Record', description: 'Sing the whole song through. Record it. Listen back and note 2 things to improve.', duration_secs: 0, target_reps: 1, difficulty: 3 },
        ],
      },
    ],
  },
  {
    id: 'tpl_piano',
    name: 'Piano',
    category: 'Music',
    icon: '🎹',
    description: 'Build technique, sight-reading, and musicality.',
    sub_skills: [
      {
        name: 'Finger Technique',
        description: 'Strengthen and independently control all fingers.',
        drills: [
          { name: 'Hanon Exercises', description: 'Play Hanon exercise 1–5 at slow tempo, then increase by 5 BPM each rep.', duration_secs: 600, target_reps: 5, difficulty: 2 },
          { name: 'Scales Hands Separate', description: 'C major scale, each hand alone, 4 octaves. Focus on evenness.', duration_secs: 300, target_reps: 3, difficulty: 2 },
        ],
      },
      {
        name: 'Sight Reading',
        description: 'Read and play new music accurately at first sight.',
        drills: [
          { name: 'New Piece Cold Read', description: 'Open any new piece, read 4 bars slowly without stopping.', duration_secs: 0, target_reps: 4, difficulty: 3 },
        ],
      },
    ],
  },
  {
    id: 'tpl_japanese',
    name: 'Japanese',
    category: 'Language',
    icon: '🇯🇵',
    description: 'Build reading, listening, speaking, and vocabulary systematically.',
    sub_skills: [
      {
        name: 'Vocabulary',
        description: 'Expand active and passive vocabulary.',
        drills: [
          { name: 'Anki Flashcard Session', description: 'Review due cards + add 10 new words. Aim for >90% retention.', duration_secs: 1200, target_reps: 10, difficulty: 2 },
          { name: 'Shadowing Vocabulary', description: 'Listen to a native sentence, shadow it 5× focusing on pitch accent.', duration_secs: 600, target_reps: 10, difficulty: 3 },
        ],
      },
      {
        name: 'Grammar',
        description: 'Solidify JLPT N4-N3 grammar patterns.',
        drills: [
          { name: 'Pattern Drilling', description: 'Pick one grammar pattern (e.g. ～てしまう). Write 5 original sentences using it.', duration_secs: 0, target_reps: 5, difficulty: 3 },
          { name: 'Error Correction', description: 'Write 5 sentences, get corrected (HiNative or LangCorrect). Note each error type.', duration_secs: 0, target_reps: 5, difficulty: 4 },
        ],
      },
      {
        name: 'Listening',
        description: 'Train ear for natural speech speed.',
        drills: [
          { name: 'Podcast Shadowing', description: 'Listen to 2 minutes of Japanese podcast. Shadow immediately after each sentence.', duration_secs: 600, target_reps: 3, difficulty: 3 },
        ],
      },
    ],
  },
  {
    id: 'tpl_public_speaking',
    name: 'Public Speaking',
    category: 'Communication',
    icon: '🎙️',
    description: 'Build confidence, clarity, and audience connection.',
    sub_skills: [
      {
        name: 'Voice Projection',
        description: 'Fill a room with clear, confident sound.',
        drills: [
          { name: 'Volume Ladder', description: 'Recite a paragraph at 5 volume levels from whisper to full projection.', duration_secs: 300, target_reps: 5, difficulty: 2 },
        ],
      },
      {
        name: 'Structure',
        description: 'Open strong, body clear, close memorable.',
        drills: [
          { name: '2-Minute Talk', description: 'Pick a random topic. Speak for exactly 2 minutes with a clear point. Record it.', duration_secs: 120, target_reps: 3, difficulty: 3 },
        ],
      },
    ],
  },
];

export const MOTIVATION_SEEDS: Record<string, string[]> = {
  tpl_badminton: [
    "If my footwork is stable, those who want me to lose will be so shocked.",
    "Every drill I finish is a weapon they don't know I have.",
    "When I step on court, my preparation speaks louder than words.",
  ],
  tpl_singing: [
    "The voice that once cracked will make them go silent.",
    "Every practice session builds the performance they'll never forget.",
    "My voice is mine to master — and I'm claiming it.",
  ],
  tpl_japanese: [
    "The day I speak fluently, all the hours will finally make sense.",
    "Every word I learn is a door only I can open.",
  ],
  default: [
    "The version of me after 100 hours of this will be unrecognisable.",
    "I chose this. I'll see it through.",
    "Discomfort during practice means I am growing.",
  ],
};

// ─── UAT Fix: Preset "Prove Them Wrong" statements ───────────────────────
// Shown as quick-pick chips in the Vault so users don't have to write from scratch.

export const PROVE_THEM_WRONG_PRESETS: string[] = [
  "If my footwork is stable, those who want me to lose will be so shocked.",
  "They said I couldn't. Every rep I do proves them wrong.",
  "The people who doubted me are my best training partners.",
  "I will show up so prepared that losing becomes their problem.",
  "They underestimated me. That was their last mistake.",
  "Every time they counted me out, I was in the gym counting reps.",
  "My silence now will be my performance later.",
  "I don't need to talk about it. My results will.",
  "When I walk in fully prepared, doubt has no room to stand.",
  "The day they see what I've become, they won't be able to look away.",
];
