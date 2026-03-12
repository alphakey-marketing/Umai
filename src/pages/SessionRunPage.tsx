import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getLocalSkills, getLocalMotivations } from '../lib/storage';
import FireSplash from '../components/FireSplash';
import ZonePicker from '../components/ZoneBadge';
import type { Drill, ZoneRating, DrillLog } from '../types';

type Phase = 'splash' | 'drilling' | 'zone' | 'done';

export default function SessionRunPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { skillId, drillIds } = (location.state ?? {}) as { skillId: string; drillIds: string[] };

  const skill = getLocalSkills().find(s => s.id === skillId);
  const allDrills: Drill[] = skill?.sub_skills.flatMap(ss => ss.drills) ?? [];
  const drills = drillIds
    .map(id => allDrills.find(d => d.id === id))
    .filter(Boolean) as Drill[];

  const [phase, setPhase] = useState<Phase>('splash');
  const [drillIdx, setDrillIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [zone, setZone] = useState<ZoneRating | null>(null);
  const [logs, setLogs] = useState<DrillLog[]>([]);
  const [showFireFlash, setShowFireFlash] = useState(false);
  const [panicCount, setPanicCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const sessionStartRef = useRef<string>(new Date().toISOString());

  const currentDrill = drills[drillIdx];

  // Auto-trigger fire flash when panic zone selected twice in a row
  useEffect(() => {
    if (panicCount >= 2) {
      setShowFireFlash(true);
      setPanicCount(0);
    }
  }, [panicCount]);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now() - elapsed * 1000;
    setRunning(true);
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 500);
  }, [elapsed]);

  const stopTimer = useCallback(() => {
    setRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function confirmZone() {
    if (!zone || !currentDrill) return;
    const log: DrillLog = {
      drill_id: currentDrill.id,
      drill_name: currentDrill.name,
      duration_actual_secs: elapsed,
      reps_completed: currentDrill.target_reps,
      zone_ratings: [zone],
    };
    const newLogs = [...logs, log];
    setLogs(newLogs);

    if (zone === 'panic') setPanicCount(c => c + 1);
    else setPanicCount(0);

    if (drillIdx + 1 < drills.length) {
      setDrillIdx(i => i + 1);
      setElapsed(0);
      setZone(null);
      setPhase('drilling');
      setRunning(false);
    } else {
      // All drills done — go to post-session
      navigate('/session/feedback', {
        state: {
          skillId,
          drillLogs: newLogs,
          sessionStart: sessionStartRef.current,
        },
      });
    }
  }

  function endDrill() {
    stopTimer();
    setPhase('zone');
  }

  const target = currentDrill?.duration_secs ?? 0;
  const progress = target > 0 ? Math.min((elapsed / target) * 100, 100) : 0;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  if (!skill || drills.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">Session data missing. <button onClick={() => navigate('/session')} className="text-orange-400 underline">Go back</button></p>
      </div>
    );
  }

  // ── Splash screen ──
  if (phase === 'splash') {
    return <FireSplash onDone={() => { setPhase('drilling'); }} />;
  }

  // ── Mid-session fire flash ──
  const motivations = getLocalMotivations();
  const favs = motivations.filter(m => m.is_favourite);
  const flashPool = favs.length > 0 ? favs : motivations;
  const flashStatement = flashPool.length > 0
    ? flashPool[Math.floor(Math.random() * flashPool.length)].statement
    : null;

  return (
    <div className="space-y-6">
      {/* Mid-session fire flash overlay */}
      {showFireFlash && flashStatement && (
        <div className="fixed inset-0 z-50 bg-gray-950/95 flex items-center justify-center px-8 text-center">
          <div className="space-y-4 max-w-sm">
            <p className="text-4xl">❤️‍🔥</p>
            <p className="text-xl font-black text-white leading-snug">This difficulty means you're growing.</p>
            <p className="text-lg text-orange-300 font-semibold italic">"{flashStatement}"</p>
            <button
              onClick={() => setShowFireFlash(false)}
              className="mt-2 bg-orange-500 hover:bg-orange-400 text-white font-bold px-6 py-2 rounded-xl"
            >
              Let's go 🔥
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">{skill.icon}</span>
        <div>
          <h1 className="font-black text-lg">{skill.name}</h1>
          <p className="text-xs text-gray-400">Drill {drillIdx + 1} of {drills.length}</p>
        </div>
        <button
          onClick={() => setShowFireFlash(true)}
          className="ml-auto text-2xl hover:scale-125 transition-transform"
          title="Fire me up!"
        >
          ❤️‍🔥
        </button>
      </div>

      {/* Progress bar (drills) */}
      <div className="w-full bg-gray-800 rounded-full h-1.5">
        <div
          className="bg-orange-500 h-1.5 rounded-full transition-all"
          style={{ width: `${((drillIdx) / drills.length) * 100}%` }}
        />
      </div>

      {/* Drill card */}
      {phase === 'drilling' && currentDrill && (
        <div className="rounded-2xl bg-gray-900 border border-gray-800 p-5 space-y-4">
          <div>
            <p className="text-xl font-black">{currentDrill.name}</p>
            <p className="text-sm text-gray-400 mt-1 leading-relaxed">{currentDrill.description}</p>
            <div className="flex gap-3 mt-2 text-xs text-gray-600">
              {currentDrill.duration_secs > 0 && <span>⏱ Target: {Math.floor(currentDrill.duration_secs / 60)}m {currentDrill.duration_secs % 60 > 0 ? `${currentDrill.duration_secs % 60}s` : ''}</span>}
              {currentDrill.target_reps > 0 && <span>🔁 {currentDrill.target_reps} reps</span>}
            </div>
          </div>

          {/* Timer */}
          <div className="text-center py-4">
            <p className="text-6xl font-black tabular-nums">{mm}:{ss}</p>
            {target > 0 && (
              <div className="mt-3 w-full bg-gray-800 rounded-full h-2">
                <div
                  className="bg-orange-500 h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>

          {/* Timer controls */}
          <div className="flex gap-3">
            {!running ? (
              <button
                onClick={startTimer}
                className="flex-1 bg-orange-500 hover:bg-orange-400 text-white font-bold py-3 rounded-xl transition-colors"
              >
                {elapsed === 0 ? '▶ Start' : '▶ Resume'}
              </button>
            ) : (
              <button
                onClick={stopTimer}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition-colors"
              >
                ⏸ Pause
              </button>
            )}
            <button
              onClick={endDrill}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-xl border border-gray-700 transition-colors"
            >
              Done ✓
            </button>
          </div>
        </div>
      )}

      {/* Zone picker */}
      {phase === 'zone' && (
        <div className="rounded-2xl bg-gray-900 border border-gray-800 p-5 space-y-4">
          <p className="font-bold">You finished: <span className="text-orange-400">{currentDrill?.name}</span></p>
          <ZonePicker selected={zone} onChange={setZone} />
          <button
            onClick={confirmZone}
            disabled={!zone}
            className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {drillIdx + 1 < drills.length ? 'Next Drill →' : 'Finish Session 🎉'}
          </button>
        </div>
      )}

      {/* Drill queue */}
      <div className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-600">Session Queue</p>
        {drills.map((d, i) => (
          <div
            key={d.id}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
              i < drillIdx ? 'text-gray-600 line-through' :
              i === drillIdx ? 'text-white font-semibold bg-gray-800' :
              'text-gray-500'
            }`}
          >
            <span>{i < drillIdx ? '✓' : i === drillIdx ? '▶' : '○'}</span>
            {d.name}
          </div>
        ))}
      </div>
    </div>
  );
}
