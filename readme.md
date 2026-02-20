# B-AI Chat Demo

React + Vite chat UI (shadcn/ui + motion) with a local backend that calls OpenRouter.

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from the example:

```bash
cp .env.example .env
```

3. Put your OpenRouter key in `.env`:

```env
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_HTTP_REFERER=http://localhost:5173
OPENROUTER_X_TITLE=B-AI Chat Demo
PORT=8787
```

4. Start both backend and frontend:

```bash
npm run dev
```

5. Open the app URL printed by Vite (usually `http://localhost:5173`).

## Model Selection

- In the Settings panel, choose `deepseek/deepseek-r1-0528:free` to match the free sample model.
- Toggle `Use OpenRouter API` off to use local mock responses.

## Scripts

- `npm run dev` starts server + client
- `npm run lint` runs ESLint
- `npm run build` builds production assets
