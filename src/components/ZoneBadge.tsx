import type { ZoneRating } from '../types';

const CONFIG: Record<ZoneRating, { label: string; emoji: string; color: string; hint: string }> = {
  comfort:  { label: 'Too Easy',   emoji: '🟢', color: 'border-green-600  bg-green-950/40  text-green-300',  hint: 'Increase reps or add a constraint next set.' },
  learning: { label: 'Just Right', emoji: '🟡', color: 'border-yellow-500 bg-yellow-950/40 text-yellow-200', hint: 'Perfect zone. Stay here.' },
  panic:    { label: 'Too Hard',   emoji: '🔴', color: 'border-red-600    bg-red-950/40    text-red-300',    hint: 'Simplify one element. You are still growing.' },
};

interface Props {
  selected: ZoneRating | null;
  onChange: (z: ZoneRating) => void;
}

export default function ZonePicker({ selected, onChange }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-500">How was that set?</p>
      <div className="grid grid-cols-3 gap-2">
        {(Object.entries(CONFIG) as [ZoneRating, typeof CONFIG[ZoneRating]][]).map(([z, cfg]) => (
          <button
            key={z}
            onClick={() => onChange(z)}
            className={`rounded-xl border-2 p-3 text-center transition-all ${
              selected === z ? cfg.color + ' scale-105' : 'border-gray-700 bg-gray-900 text-gray-500 hover:border-gray-500'
            }`}
          >
            <div className="text-xl">{cfg.emoji}</div>
            <div className="text-xs font-semibold mt-1">{cfg.label}</div>
          </button>
        ))}
      </div>
      {selected && (
        <p className="text-xs text-gray-400 italic text-center">{CONFIG[selected].hint}</p>
      )}
    </div>
  );
}
