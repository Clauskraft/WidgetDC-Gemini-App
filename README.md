# ArchitectGPT Frontend

This is a full-stack React + Express + Vite application utilizing a server-side model provider and WidgeTDC MCP extensions for agentic behaviors.

## How to run the application

1. Install dependencies:
```bash
npm install
```

2. Start the development server (runs React + Express locally):
```bash
npm run dev
```

3. Build the application for production:
```bash
npm run build
```

4. Lint the codebase:
```bash
npm run lint
```

## Required Environment Variables

The application requires several environment variables to function properly. See `.env.example` for all variables.
- `GEMINI_API_KEY`: Optional server-side provider key. Must be kept secret and must never be exposed to the browser.
- `RUNTIME_MODEL` / `GENERATIVE_MODEL`: Optional server-side model selector. If unset, the BFF returns local synthesis instead of calling a hardcoded model.
- `PORT`: Automatically configured during build/deploy (default 3000).
- `ALLOW_DEV_AUTH_BYPASS`: Set to `true` to disable simple auth requirements on the local `/api/chat` endpoint.
- `DEBUG_PROXY`: Set to `true` to log verbose data proxy paths in backend testing.
- `SUPABASE_URL` / `SUPABASE_ANON_KEY`: If not provided, thread history will use in-memory volatile storage.

## Important Notes
- **Provider Key**: Provider keys are ONLY used on the server in `server.ts`. They are strictly not bundled with the frontend via Vite build configurations.
- **Dashboard Data**: The internal Dashboard visualizations showcase static preview data representing the May 2026 milestones unless customized entirely with a live analytics integration backend.
- **Proposals & Tests**: The `src/modules/proposals` and `scripts/smoke` folders contain reference implementations and manual scripts that are NOT actively evaluated by the application TS runtime.
