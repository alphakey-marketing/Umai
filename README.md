# うまい — Japanese Shadowing App

> **Get Good at Japanese.** Shadow anime. Save sentences. Build fluency one line at a time.

Built with **React + TypeScript + Tailwind + Vite**, deployed on Replit.

## What is this?

うまい (Umai) is a personal Japanese learning tool focused on **shadowing** — the method of listening to native audio and immediately repeating it, matching rhythm, intonation and speed. It's designed for JLPT N4→N3 learners who want to learn from anime.

## Features (Roadmap)

| Phase | Status | Feature |
|-------|--------|---------|
| **1** | ✅ Done | Retheme, TypeScript types, anime library seed, new HomePage, Anime Library page |
| **2** | 🔜 Next | Subtitle engine (SRT parser + Whisper API), SubtitlePlayer component |
| **3** | ⏳ | Shadowing mode in SessionRunPage (auto-pause, repeat, hide/reveal) |
| **4** | ⏳ | Vocabulary Vault — save sentences, export to Anki |
| **5** | ⏳ | Progress dashboard — streaks, JLPT coverage, self-rating trends |
| **6** | ⏳ | Full Anime Library with episode picker and difficulty filters |

## Anime Library (seeded)

| Anime | JLPT | Tags |
|-------|------|------|
| しろくまカフェ | N4 | 日常会話 |
| ゆるキャン△ | N3 | 日常会話, 自然 |
| 甘々と稲妻 | N3 | 日常会話, 料理, 学校 |
| 名探偵コナン | N3 | 日常会話, 推理 |
| 日常 | N3 | 日常会話, 学校 |

## Tech Stack

- React 18 + TypeScript
- Tailwind CSS
- Vite
- localStorage (offline-first, Supabase-ready)
- Replit for deployment

## Phase 2 Preview

Next up: `src/lib/subtitleParser.ts` — parse `.srt` files into `SubtitleLine[]` — and `src/components/SubtitlePlayer.tsx` — the core shadowing UI that advances lines in sync with a `<video>` element.
