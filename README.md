# Umai うまい — Deliberate Practice App

Build real skill through deliberate practice. Structured drill trees, fire motivation, and progress tracking.

## Stack
- React 18 + TypeScript + Vite
- Tailwind CSS (dark theme)
- Supabase (Auth + DB) — Phase 3
- Gemini 2.0 Flash API (AI drills) — Phase 3

## Phase 1 — Complete ✅
- [x] Navigation (desktop + mobile bottom nav)
- [x] Home dashboard with stats
- [x] Skill Template Library (Badminton, Singing, Piano, Japanese, Public Speaking)
- [x] Clone template → auto-seeds skill tree + motivations
- [x] My Skills — create, view, delete custom skills
- [x] Skill Detail — add/edit/delete sub-skills and drills
- [x] Motivation Vault — Fire Statements with categories, star, rival energy field
- [x] Offline-first (localStorage), ready for Supabase sync

## Phase 1 UAT Fix ✅
- [x] Preset "Prove Them Wrong" statements — 10 quick-pick chips in Vault

## Phase 2 — Complete ✅
- [x] Session Setup — pick skill + drills for today
- [x] Fire Splash — full-screen motivation before every session
- [x] Session Timer — per-drill countdown with start/pause/done
- [x] Zone Tracker — comfort / learning / panic rating after each drill
- [x] Mid-session Fire Flash — auto-triggers on 2× panic; manual ❤️‍🔥 button
- [x] Post-session Feedback — focus score, drill breakdown, star rating, reflection prompts
- [x] Session History — all sessions logged, avg focus, total minutes

## Phase 3 — Complete ✅
- [x] Progress Dashboard — focus score trend chart, zone distribution bar, per-skill sparklines, streak counter
- [x] Supabase sync layer — `src/lib/supabase.ts` + `src/lib/sync.ts` (graceful no-op when keys absent)
- [x] Sessions now sync to Supabase on save (fire-and-forget, localStorage always written first)
- [x] Gemini AI drill suggestions — `src/lib/gemini.ts` analyses session zone data and suggests 3 targeted drills per sub-skill
- [x] AI suggestions appear inline in Skill Detail, one-tap to adopt into drill tree
- [x] Home page shows integration status (Supabase / Gemini active or not)

## Getting Started

```bash
npm install
npm run dev
```

## Environment Variables

Create a `.env` file in the project root:

```env
# Supabase — enables cloud sync across devices
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Gemini — enables AI drill suggestions in Skill Detail
VITE_GEMINI_API_KEY=your-gemini-api-key
```

All three integrations are optional. The app works fully offline without them.

## Supabase SQL (run in Supabase SQL editor)

```sql
create table profiles (
  id uuid primary key,
  user_id uuid references auth.users,
  display_name text,
  created_at timestamptz default now()
);

create table skills (
  id uuid primary key,
  user_id uuid,
  name text,
  category text,
  icon text,
  created_at timestamptz default now()
);

create table sub_skills (
  id uuid primary key,
  skill_id uuid references skills(id) on delete cascade,
  name text,
  description text,
  order_index int
);

create table drills (
  id uuid primary key,
  sub_skill_id uuid references sub_skills(id) on delete cascade,
  name text,
  description text,
  duration_secs int,
  target_reps int,
  difficulty smallint
);

create table motivations (
  id uuid primary key,
  user_id uuid,
  statement text,
  is_favourite boolean default false,
  category text,
  created_at timestamptz default now()
);

create table sessions (
  id uuid primary key,
  user_id uuid,
  skill_id uuid,
  skill_name text,
  skill_icon text,
  started_at timestamptz,
  ended_at timestamptz,
  overall_rating smallint,
  went_well text,
  improve_next text,
  focus_score int
);

create table session_drill_logs (
  id uuid primary key,
  session_id uuid references sessions(id) on delete cascade,
  drill_id uuid,
  drill_name text,
  duration_actual_secs int,
  reps_completed int,
  zone_ratings text[]
);
```

## Phase 4 — Planned
- Supabase Auth (sign up / log in, migrate guest data)
- Edit existing drills in-place
- Rep counter during session
- Audio/video clip attachment to drills
- Weekly email digest (Supabase Edge Functions)
