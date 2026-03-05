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
- Styling: Tailwind CSS v4 + shadcn/ui (backed by `radix-ui` + `@base-ui/react`)
- Animation: `motion` (motion.dev)
- Text scramble: `use-scramble` (used in `TypingStatus`)
- Backend: Express 5 (`server/index.js`)
- AI provider: OpenRouter API

## 3) Project Layout

- `src/App.tsx`: app orchestration, state, chat flow, status indicator flow, stats
- `src/features/chat/components/chat-phone.tsx`: phone frame shell, scroll management, layout
- `src/features/chat/components/chat-bubble.tsx`: message rendering (user + assistant), action toolbar, meta popup
- `src/features/chat/components/chat-composer.tsx`: input form with animated rotating placeholder
- `src/features/chat/components/chat-starter-prompts.tsx`: starter prompt chips always visible in chat
- `src/features/chat/components/typing-status.tsx`: animated scrambled status indicator
- `src/features/chat/api/send-chat.ts`: client streaming request handling (SSE parser, abort, timeout)
- `src/features/chat/types.ts`: shared domain types (`ChatMessage`, `ChatSettings`, `ChatMessageMeta`)
- `src/features/chat/constants.ts`: `TYPING_STATES`, `TYPING_STATE_MS`, `TYPING_MIN_DURATION_MS`
- `src/features/chat/data/chat-prompts.ts`: `CHAT_PROMPTS` definitions and `CHAT_PROMPT_PLACEHOLDERS`
- `src/features/chat/data/starter-messages.ts`: initial messages array (currently empty)
- `src/features/chat/utils/create-assistant-reply.ts`: mock reply generator for offline mode
- `src/features/settings/components/settings-panel.tsx`: settings UI with stats display
- `server/index.js`: `/api/health`, `/api/chat`, `/api/chat/stream` — proxy to OpenRouter
- `src/components/ui/*`: shadcn primitives

## 4) Runtime Contracts

- Frontend calls `/api/*` through Vite proxy in `vite.config.ts` (to `http://localhost:8787`).
- API key is server-side only via env vars:
  - `OPENROUTER_API_KEY`
  - `OPENROUTER_HTTP_REFERER` (optional)
  - `OPENROUTER_X_TITLE` (optional)
  - `PORT` (default `8787`)
- Never expose provider secrets in client code.
- Dev: run both client and server with `npm run dev` (uses `concurrently`).
- Build: `npm run build` (TypeScript check + Vite bundle). Preview: `npm run preview`.

### npm scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start both client (Vite) and server (node --watch) concurrently |
| `npm run dev:client` | Vite dev server only |
| `npm run dev:server` | Express server only (`node --watch server/index.js`) |
| `npm run build` | `tsc -b && vite build` |
| `npm run lint` | ESLint across the project |
| `npm run preview` | Preview the production build |

## 5) Non-Negotiable Engineering Rules

- Use `npm` for all package and script operations.
- Keep TypeScript strictness intact.
- Prefer feature-local changes; do not create cross-file churn unless needed.
- Do not edit generated assets (`dist/`) for feature work.
- Keep UI behavior consistent with current product decisions unless explicitly requested.
- Preserve accessibility basics (`aria-label`, focus behavior, disabled states).

## 6) Chat UX Rules (Current Product Behavior)

- Chat runs inside a phone mockup (`phone-frame`) with internal scrolling.
- Assistant messages are plain text style (not bubble cards); streaming shows a blinking cursor.
- User messages are right-aligned blue bubbles.
- Status indicator (`TypingStatus`) cycles through states using `use-scramble` for a text-scramble effect:
  - `Thinking...`
  - `Processing...`
  - `Typing...`
- Indicator appears as a list item after the last message (inside `AnimatePresence`).
- Starter prompts are always visible in the chat scroll area; clicking one **prefills the composer draft** (does not auto-submit).
- Composer placeholder rotates through `CHAT_PROMPT_PLACEHOLDERS` (every 2800ms) after the first message is sent, pausing when the user focuses the input.
- Assistant message action toolbar (visible on every assistant bubble):
  - **Copy** — copies text to clipboard
  - **Branch out** (`GitBranch` icon) — UI only, no behavior wired yet
  - **Regenerate** (`RotateCcw`) — re-runs the assistant reply for that turn
  - **More** (`...`) — toggles inline meta popup (model, temperature, tokens, latency, char/word count, source)

## 7) Implementation Patterns

- Keep chat flow logic centralized in `src/App.tsx`.
- Keep visual-only concerns in component files.
- Reuse utilities and typed interfaces from `src/features/chat/types.ts`.
- For async flows:
  - Set busy flags first
  - Clear them in `finally`
  - Always handle fallback path for provider errors

## 8) API Behavior Expectations

- `/api/health`: GET — returns `{ ok: true }`, useful for uptime checks.
- `/api/chat`: POST — non-streaming JSON response `{ text, usage? }`. Server timeout: 45s.
- `/api/chat/stream`: POST — SSE event-stream with typed events (`chunk`, `usage`, `done`, `error`). Server timeout: 60s. Client timeout: 60s.
- Both chat endpoints accept `{ messages, settings }` in the request body.
- Server trims conversation history to the **last 20 messages** before sending to OpenRouter.
- `max_tokens` is `220` when `conciseMode` is `true`, `500` otherwise.
- System prompt is derived from `settings.persona`; falls back to `"You are a helpful AI assistant."`.
- Timeouts and abort controllers must be preserved.
- Any change to server payload structure requires matching update in frontend parser.
- Client aborts the stream if the connection closes (server listens on `res` `close` event).

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
