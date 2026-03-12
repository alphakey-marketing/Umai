import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../lib/settingsContext';
import type { JLPTGoal } from '../lib/settings';

const JLPT_LEVELS: { level: JLPTGoal; label: string; hint: string }[] = [
  { level: 'N5', label: 'N5', hint: 'Complete beginner — hiragana, basic vocab' },
  { level: 'N4', label: 'N4', hint: 'Basic sentences, ~1500 words (anime-ready!)' },
  { level: 'N3', label: 'N3', hint: 'Intermediate — slice-of-life anime comfortable' },
  { level: 'N2', label: 'N2', hint: 'Upper intermediate — most native content' },
  { level: 'N1', label: 'N1', hint: 'Near-native fluency' },
];

export default function OnboardingPage() {
  const { update } = useSettings();
  const navigate   = useNavigate();
  const [step, setStep]           = useState(0);
  const [name, setName]           = useState('');
  const [jlpt, setJlpt]           = useState<JLPTGoal>('N4');

  function finish() {
    update({ onboarded: true, display_name: name.trim() || 'Senpai', jlpt_goal: jlpt });
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-8">

        {step === 0 && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center space-y-2">
              <p className="text-6xl">🍣</p>
              <h1 className="text-3xl font-black">Welcome to Umai</h1>
              <p className="text-gray-400">Your Japanese shadowing dojo. Learn by listening, speaking, and repeating.</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-indigo-400">What should we call you?</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name or nickname"
                autoFocus
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              onClick={() => setStep(1)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-base py-4 rounded-2xl transition-colors"
            >
              Let’s Go →
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <p className="text-5xl">🏆</p>
              <h2 className="text-2xl font-black">What’s your JLPT goal?</h2>
              <p className="text-gray-400 text-sm">We’ll recommend anime and sessions to match your level.</p>
            </div>
            <div className="space-y-2">
              {JLPT_LEVELS.map(({ level, label, hint }) => (
                <button
                  key={level}
                  onClick={() => setJlpt(level)}
                  className={`w-full flex items-center gap-4 rounded-2xl border-2 px-4 py-3 text-left transition-all ${
                    jlpt === level
                      ? 'border-indigo-500 bg-indigo-950/40'
                      : 'border-gray-700 bg-gray-900 hover:border-gray-500'
                  }`}
                >
                  <span className={`text-2xl font-black ${
                    jlpt === level ? 'text-indigo-400' : 'text-gray-500'
                  }`}>{label}</span>
                  <div>
                    <p className="text-sm font-bold">{label} Level</p>
                    <p className="text-xs text-gray-400">{hint}</p>
                  </div>
                  {jlpt === level && <span className="ml-auto text-indigo-400">✔️</span>}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-base py-4 rounded-2xl transition-colors"
            >
              Next →
            </button>
            <button onClick={() => setStep(0)} className="w-full text-gray-600 text-sm hover:text-white">← Back</button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <p className="text-5xl">🎬</p>
              <h2 className="text-2xl font-black">How it works</h2>
            </div>
            <div className="space-y-3">
              {([
                ['👀', 'Watch', 'Play your anime with Japanese subtitles.'],
                ['⏸️', 'Pause', 'Umai auto-pauses after each subtitle line.'],
                ['🗣️', 'Shadow', 'Repeat the line aloud — match the rhythm and tone.'],
                ['📚', 'Save', 'Press S to save tough sentences to your Vault.'],
                ['♻️', 'Review', 'Export saved sentences to Anki for spaced repetition.'],
              ] as const).map(([emoji, title, desc]) => (
                <div key={title} className="flex items-start gap-4">
                  <span className="text-2xl w-8 shrink-0">{emoji}</span>
                  <div>
                    <p className="font-bold text-sm">{title}</p>
                    <p className="text-xs text-gray-400">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={finish}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-lg py-4 rounded-2xl transition-colors"
            >
              女 Start Shadowing!
            </button>
            <button onClick={() => setStep(1)} className="w-full text-gray-600 text-sm hover:text-white">← Back</button>
          </div>
        )}

        {/* Step indicator */}
        <div className="flex justify-center gap-2">
          {[0, 1, 2].map(i => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${
              i === step ? 'w-6 bg-indigo-500' : 'w-1.5 bg-gray-700'
            }`} />
          ))}
        </div>
      </div>
    </div>
  );
}
