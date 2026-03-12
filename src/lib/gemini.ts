/**
 * Gemini AI integration for drill suggestions.
 * Falls back gracefully when VITE_GEMINI_API_KEY is not set.
 */

import type { AIDrillSuggestion, Session, SubSkill } from '../types';

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export function isGeminiAvailable(): boolean {
  return !!GEMINI_KEY;
}

function buildPrompt(
  skillName: string,
  subSkill: SubSkill,
  recentSessions: Session[],
): string {
  const zoneSummary = recentSessions
    .flatMap(s => s.drill_logs)
    .filter(l => subSkill.drills.some(d => d.id === l.drill_id))
    .map(l => `${l.drill_name}: ${l.zone_ratings.join(', ')}`)
    .slice(0, 10)
    .join('\n') || 'No recent session data';

  const existingDrills = subSkill.drills
    .map(d => `- ${d.name} (difficulty ${d.difficulty}/5, ${d.target_reps} reps, ${d.duration_secs}s)`)
    .join('\n');

  return `You are a deliberate practice coach for "${skillName}" — sub-skill: "${subSkill.name}".

Existing drills:
${existingDrills}

Recent zone ratings from practice sessions:
${zoneSummary}

Based on deliberate practice principles (Ericsson), suggest 3 new drills that:
1. Target the specific weak points revealed by panic/comfort zone data
2. Are distinct from existing drills
3. Follow progressive overload

Respond ONLY with a valid JSON array of 3 objects, no markdown, no explanation:
[
  {
    "name": "string",
    "description": "string (1-2 sentences, actionable)",
    "duration_secs": number,
    "target_reps": number,
    "difficulty": number (1-5),
    "reasoning": "string (1 sentence why this drill)"
  }
]`;
}

export async function fetchAIDrillSuggestions(
  skillName: string,
  subSkill: SubSkill,
  recentSessions: Session[],
): Promise<AIDrillSuggestion[]> {
  if (!GEMINI_KEY) {
    throw new Error('VITE_GEMINI_API_KEY not set');
  }

  const prompt = buildPrompt(skillName, subSkill, recentSessions);

  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    }),
  });

  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);

  const json = await res.json();
  const text: string = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  // Strip possible markdown code fences
  const cleaned = text.replace(/```json|```/g, '').trim();
  const suggestions: AIDrillSuggestion[] = JSON.parse(cleaned);
  return suggestions;
}
