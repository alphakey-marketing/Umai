import { useEffect, useState } from 'react';
import { getLocalMotivations } from '../lib/storage';

interface Props {
  onDone: () => void;
}

export default function FireSplash({ onDone }: Props) {
  const [seconds, setSeconds] = useState(5);
  const [statement] = useState(() => {
    const favs = getLocalMotivations().filter(m => m.is_favourite);
    const pool = favs.length > 0 ? favs : getLocalMotivations();
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)].statement;
  });
  const rivalText = localStorage.getItem('umai_rival') ?? '';

  useEffect(() => {
    if (!statement) { onDone(); return; }
    const t = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { clearInterval(t); onDone(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [statement, onDone]);

  if (!statement) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center px-8 text-center">
      <div className="space-y-6 max-w-lg">
        <p className="text-5xl">❤️‍🔥</p>
        <blockquote className="text-2xl font-black text-white leading-snug">
          "{statement}"
        </blockquote>
        {rivalText && (
          <p className="text-sm text-red-400 italic">😤 {rivalText}</p>
        )}
        <p className="text-gray-600 text-sm">Session starts in {seconds}…</p>
        <button
          onClick={onDone}
          className="text-xs text-gray-600 hover:text-gray-400 underline"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
