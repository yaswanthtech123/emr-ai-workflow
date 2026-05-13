# EMR AI Workflow Prototype

A focused technical assignment prototype for an EMR-style healthcare workflow using synthetic data only.

## Completed Scope

- Open one predefined synthetic patient and display minimal context.
- Paste a synthetic consultation transcript.
- Generate SOAP draft (`Subjective`, `Objective`, `Assessment`, `Plan`) via **real AI API call through backend**.
- Edit SOAP fields in frontend before save.
- Save final note and show visit history.
- Record audit events for AI generation and final save.
- Enforce backend role check (`x-user-role: doctor`) for generate/save actions.

## Project Structure

- `frontend/` - React + Vite UI
- `backend/` - Express API + OpenAI integration + JSON persistence
- `.env.example` - required environment variables

## Local Setup

### 1) Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2) Configure environment

Copy `.env.example` values into your local env files.

Backend expects:

- `PORT`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

Frontend expects:

- `VITE_API_BASE_URL`

### 3) Run backend

```bash
cd backend
OPENAI_API_KEY=your_key_here npm run dev
```

### 4) Run frontend

```bash
cd frontend
VITE_API_BASE_URL=http://localhost:4000/api npm run dev
```

### 5) Demo role behavior

Use role selector in UI:

- `doctor` can generate and save notes.
- non-doctor (`frontdesk`, `auditor`) receives backend `403` on generate/save.

## Backend/API Overview

### Routes

- `GET /api/patient` - returns predefined synthetic patient.
- `POST /api/ai/generate-soap` - validates payload, checks doctor role, calls OpenAI, returns SOAP draft, logs audit event.
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
6. **AI provider/model:** OpenAI Chat Completions API with `response_format: json_object` to constrain SOAP output structure.
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
