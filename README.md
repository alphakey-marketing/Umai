# Umai うまい — Deliberate Practice App

Build real skill through deliberate practice. Structured drill trees, fire motivation, and progress tracking.

## Stack
- React 18 + TypeScript + Vite
- Tailwind CSS (dark theme)
- Supabase (Auth + DB) — Phase 2+
- Gemini API (AI drills) — Phase 3+

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
- [x] Preset "Prove Them Wrong" statements — 10 quick-pick chips in Vault, tap to add instantly

## Phase 2 — Complete ✅
- [x] Session Setup — pick skill + drills for today
- [x] Fire Splash — full-screen motivation before every session (5s, skippable)
- [x] Session Timer — per-drill countdown with start/pause/done
- [x] Zone Tracker — comfort / learning / panic rating after each drill
- [x] Mid-session Fire Flash — auto-triggers on 2× panic; manual ❤️‍🔥 button
- [x] Post-session Feedback — focus score, drill breakdown, star rating, reflection prompts
- [x] Session History — all sessions logged, avg focus, total minutes
- [x] Session types + storage helpers added

## Getting Started

```bash
npm install
npm run dev
```

For Supabase (Phase 3), add `.env`:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Supabase SQL (Phase 3 setup)
```sql
create table profiles (id uuid primary key, user_id uuid references auth.users, display_name text, created_at timestamptz default now());
create table skills (id uuid primary key, user_id uuid, name text, category text, icon text, created_at timestamptz default now());
create table sub_skills (id uuid primary key, skill_id uuid references skills(id) on delete cascade, name text, description text, order_index int);
create table drills (id uuid primary key, sub_skill_id uuid references sub_skills(id) on delete cascade, name text, description text, duration_secs int, target_reps int, difficulty smallint);
create table motivations (id uuid primary key, user_id uuid, statement text, is_favourite boolean default false, category text, created_at timestamptz default now());
create table sessions (id uuid primary key, user_id uuid, skill_id uuid, skill_name text, skill_icon text, started_at timestamptz, ended_at timestamptz, overall_rating smallint, went_well text, improve_next text, focus_score int);
create table session_drill_logs (id uuid primary key, session_id uuid references sessions(id) on delete cascade, drill_id uuid, drill_name text, duration_actual_secs int, reps_completed int, zone_ratings text[]);
```
