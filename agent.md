# AGENT GUIDE (B-AI)

This file is the operating guide for any LLM or automation agent working in this repository.
Follow it as source-of-truth for implementation behavior.

## 1) Mission

Build and maintain a React + Vite AI chat demo with:
- Shadcn UI components
- Motion animations
- OpenRouter-backed chat (streaming + non-streaming)
- A polished mobile-chat-in-frame experience with settings panel

## 2) Tech Stack

- Frontend: React 19 + TypeScript + Vite
- Styling: Tailwind CSS v4 + shadcn/ui
- Animation: `motion` (motion.dev)
- Backend: Express (`server/index.js`)
- AI provider: OpenRouter API

## 3) Project Layout

- `src/App.tsx`: app orchestration, state, chat flow, status indicator flow, stats
- `src/features/chat/components/*`: chat UI (phone, bubbles, composer, typing status, prompts)
- `src/features/chat/api/send-chat.ts`: client streaming request handling
- `src/features/chat/types.ts`: shared domain types
- `src/features/settings/components/settings-panel.tsx`: settings UI
- `server/index.js`: `/api/chat` and `/api/chat/stream` proxy to OpenRouter
- `src/components/ui/*`: shadcn primitives

## 4) Runtime Contracts

- Frontend calls `/api/*` through Vite proxy in `vite.config.ts` (to `http://localhost:8787`).
- API key is server-side only via env vars:
  - `OPENROUTER_API_KEY`
  - `OPENROUTER_HTTP_REFERER` (optional)
  - `OPENROUTER_X_TITLE` (optional)
  - `PORT` (default `8787`)
- Never expose provider secrets in client code.

## 5) Non-Negotiable Engineering Rules

- Use `npm` for all package and script operations.
- Keep TypeScript strictness intact.
- Prefer feature-local changes; do not create cross-file churn unless needed.
- Do not edit generated assets (`dist/`) for feature work.
- Keep UI behavior consistent with current product decisions unless explicitly requested.
- Preserve accessibility basics (`aria-label`, focus behavior, disabled states).

## 6) Chat UX Rules (Current Product Behavior)

- Chat runs inside a phone mockup (`phone-frame`) with internal scrolling.
- Assistant messages are plain text style (not bubble cards).
- User messages are right-aligned bubbles.
- Status indicator has states:
  - `Thinking...`
  - `Processing...`
  - `Typing...`
- Indicator should appear as a message in the stream and be positioned under the last message.
- Starter prompts are part of chat UI and remain visible even after conversation begins.
- AI message controls:
  - Copy
  - Redo
  - More (`...`) popup with metadata

## 7) Implementation Patterns

- Keep chat flow logic centralized in `src/App.tsx`.
- Keep visual-only concerns in component files.
- Reuse utilities and typed interfaces from `src/features/chat/types.ts`.
- For async flows:
  - Set busy flags first
  - Clear them in `finally`
  - Always handle fallback path for provider errors

## 8) API Behavior Expectations

- `/api/chat`: non-stream JSON response `{ text, usage? }`
- `/api/chat/stream`: event-stream chunks with typed events (`chunk`, `usage`, `done`, `error`)
- Timeouts and abort controllers must be preserved.
- Any change to server payload structure requires matching update in frontend parser.

## 9) Coding Style

- Use `@/` alias for imports from `src`.
- Keep component props explicit and typed.
- Avoid introducing global state libraries unless requested.
- Prefer small, composable components over monolith files.
- Keep comments minimal and high-value.

## 10) Verification Before Finalizing

Run:

```bash
npm run lint
npm run build
```

If either fails, fix before handing off.

## 11) Safe Change Checklist

- Does the feature work in both mock and OpenRouter modes?
- Does the chat still scroll inside phone frame (not whole page)?
- Does streaming still render progressively?
- Do settings still update behavior correctly?
- Are secrets still server-only?
- Did lint and build pass?

## 12) What Not To Do

- Do not hardcode API keys.
- Do not move provider calls to client-side.
- Do not break message type contracts.
- Do not silently remove existing user-facing controls or stats.
