# EMR AI Workflow Prototype

A focused technical assignment prototype for an EMR-style healthcare workflow using synthetic data only.

## Completed Scope

- Open synthetic patients from JSON, select one, and display minimal context.
- Paste a synthetic consultation transcript.
- Generate SOAP draft (`Subjective`, `Objective`, `Assessment`, `Plan`) via **real AI API call through backend**.
- Edit SOAP fields in frontend before save.
- Save final note and show visit history.
- Record audit events for AI generation and final save.
- Enforce backend role check (`x-user-role: doctor`) for generate/save actions.

## Project Structure

- `frontend/` - React + Vite UI
- `backend/` - Express API + Gemini integration + JSON persistence (`data/patients.json`, `data/notes.json`, `data/audit-events.json`). Each patient may include optional **`defaultTranscript`** (≥20 chars); the UI pre-fills the transcript when that patient is selected so **Generate** is ready with role `doctor`.
- `.env.example` - required environment variables

## Local Setup

### 1) Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
cd .. && npm install
```

The root `npm install` is optional; it only adds tooling so you can start **backend and frontend together** with `npm run dev` from the repository root.

### 2) Configure environment

Copy `.env.example` values into your local env files.

Backend expects:

- `PORT`
- `GEMINI_API_KEY`
- `GEMINI_MODEL` — must be a model ID your API key supports for `generateContent` (default in code: `gemini-2.0-flash`). If you see **model not found**, try `gemini-2.5-flash-preview` or check the [models list](https://ai.google.dev/api/models).

Frontend expects:

- `VITE_API_BASE_URL`

### 3) Run the app

**Important:** `npm run dev` in `backend/` only starts the API. **Live reload and the UI come from Vite**, which starts only when you run `npm run dev` in `frontend/` (or use the combined command below). Open the URL Vite prints (usually `http://localhost:5173`), not a built `index.html` file.

**Option A — one command (backend + frontend)**

From the repository root (after `npm install` at root):

```bash
npm run dev
```

Use the local URL shown for **frontend** (Vite). Keep that process running while you edit React files; changes hot-reload.

**Option B — two terminals**

Backend:

```bash
cd backend
npm run dev
```

Frontend (separate terminal):

```bash
cd frontend
npm run dev
```

#### Backend logs

- **Foreground terminal:** All `console.log` / `console.error` output from the backend appears in the terminal where you started it (`cd backend && npm run dev`). If that terminal returns to a shell prompt, the process has exited and there will be no more logs until you start it again.
- **Root `npm run dev`:** `concurrently` prefixes lines with `[backend]` or `[frontend]` so you can tell which service logged what.
- **HTTP request lines:** When not in production, the server logs each request as `[http] METHOD path status durationms`. Set `LOG_HTTP=0` in `backend/.env` to turn that off, or `LOG_HTTP=1` to force it on.
- **Save to a file:** `cd backend && npm run dev 2>&1 | tee backend-dev.log`
- **Unhandled errors:** `unhandledRejection` and `uncaughtException` are printed to stderr (and uncaught exceptions exit the process).

### 4) Demo role behavior

Use role selector in UI:

- `doctor` can generate and save notes.
- non-doctor (`frontdesk`, `auditor`) receives backend `403` on generate/save.

## Gemini quota / “limit: 0” errors

If the API returns **`QuotaExceeded`** (HTTP **429**) or a message like **`free_tier_requests … limit: 0`**, that comes from **Google’s account and billing limits**, not from this app’s code.

Typical fixes:

1. Open [Google AI Studio](https://aistudio.google.com/) → your API key / project → **enable billing** or adjust the plan so `generateContent` has non-zero quota for the model you use (`GEMINI_MODEL`).
2. Confirm the **Generative Language API** is enabled for that Google Cloud project and the key is from the same project.
3. Wait for the **retry** window if you only hit short-term rate limits (the provider message often includes “Please retry in …s”).
4. Try another model your tier supports (update `GEMINI_MODEL` in `backend/.env`).

See also: [Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).

## Backend/API Overview

### Routes

- `GET /api/patients` - returns all synthetic patients from `backend/data/patients.json`.
- `GET /api/patients/:id` - returns one patient or `404`.
- `GET /api/patient` - **deprecated**; returns first patient for backward compatibility.
- `POST /api/ai/generate-soap` - validates payload, checks doctor role, calls Gemini, returns SOAP draft, logs audit event.
- `POST /api/notes` - validates payload, checks doctor role, saves note, logs audit event.
- `GET /api/notes?patientId=...` - returns saved notes.
- `GET /api/audit-events?patientId=...` - returns audit events.

### Validation and Error Handling

- Request validation uses `zod` schemas.
- Structured validation errors return `400`.
- Role violations return `403`.
- Unknown/internal errors return `500` with safe message.

### Storage

- Lightweight JSON files in `backend/data/`:
  - `notes.json`
  - `audit-events.json`

## Technology Decision Note

1. **Frontend framework:** React + Vite for rapid iteration and simple component state-driven UI for an 8-hour timebox.
2. **Backend framework:** Express for clear route-by-route API control and straightforward middleware for role enforcement.
3. **Data storage:** JSON-file persistence chosen over in-memory only, so data survives backend restart without database setup overhead.
4. **API design:** Small REST surface focused on assignment flow (patient, generate, save, history, audit) with explicit request/response shapes.
5. **State management:** React local state is sufficient; introducing Redux/Zustand would add complexity without benefit at this scale.
6. **AI provider/model:** Gemini `generateContent` API with JSON response MIME type to constrain SOAP output structure.
7. **Secrets handling:** API key is backend-only via env vars; no key exposure to frontend bundle.
8. **Role checks:** Backend middleware enforces `x-user-role` gate on clinical actions; frontend selector is demo-only and not trusted for authorization.
9. **Audit logging approach:** Each key action appends structured event with type, patient/visit IDs, role, timestamp, description.
10. **Production healthcare changes:** Replace mock role header with OIDC/JWT auth; move persistence to encrypted database; implement immutable audit trail with tamper detection; add PHI redaction, consent-aware logging, secure prompts/data retention controls, clinician attestation, and stronger AI safety guardrails.

## Skipped Items (Intentional)

- Full authentication and user management.
- Production database migrations and schema evolution.
- Full patient records and multi-patient workflows.
- Automated test suite and CI pipeline.
- Enterprise-grade UI polish/accessibility hardening.

These were deprioritized to focus on assignment priorities: working backend/frontend flow, real AI integration, role checks, audit events, and secure secret handling.

## Production Readiness Notes

### Authentication

Adopt OAuth2/OIDC with short-lived access tokens, refresh token rotation, and session/device controls.

### Role-Based Access

Enforce RBAC in API gateway + service layer with policy engine (role + scope + resource ownership).

### Audit Logging

Write append-only audit records to centralized immutable store (e.g., WORM/SIEM), include request IDs and actor identity.

### Patient Data Privacy

Use encryption at rest/in transit, least-privilege access, tenant segmentation, and strict data minimization.

### AI Data Protection

Route prompts through backend privacy controls, redact PHI where possible, apply provider no-train settings, and maintain data-processing agreements.

### Hallucination/Error Handling

Require clinician review, confidence/risk flags, source attribution where possible, and safe-failure UX for AI/API outages.
