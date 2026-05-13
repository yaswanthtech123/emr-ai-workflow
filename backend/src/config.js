import dotenv from 'dotenv';

// dotenv v17 logs "injected env..." by default; keep startup output minimal.
dotenv.config({ quiet: true });

/** Strip optional `models/` prefix from env (REST path already includes `models/`). */
function geminiModelId(raw) {
  const id = (raw || '').trim().replace(/^models\//, '');
  return id || 'Gemini 2.5 Flash';
}

export const config = {
  port: Number(process.env.PORT || 4000),
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  // `gemini-1.5-flash` is often retired for v1beta; default to a current Flash model.
  model: geminiModelId(process.env.GEMINI_MODEL || 'Gemini 2.5 Flash'),
};
