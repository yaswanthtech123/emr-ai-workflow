import { config } from './config.js';

/** Thrown when the AI provider returns an error; mapped to HTTP status in `server.js`. */
export class AiProviderError extends Error {
  constructor(message, { statusCode = 502, error = 'AiProviderError' } = {}) {
    super(message);
    this.name = 'AiProviderError';
    this.statusCode = statusCode;
    this.error = error;
  }
}

const SYSTEM_PROMPT = `You are assisting a clinician. All data is synthetic/demo only.
Return a concise SOAP note as strict JSON with exactly these keys:
subjective, objective, assessment, plan.
Do not wrap the JSON in markdown fences.

Naming and identifiers (critical):
- Read the consultation transcript for how the patient is addressed (e.g. "Mr. John Carter", first and last name, titles). Use that same name in the **subjective** (and elsewhere when natural)—do not drop it or replace it with only "male/female" or age alone.
- If the transcript uses a different name than any "chart context" line, trust the **transcript** for the visit narrative (the transcript is what was said in the room).
- Opening the subjective with a brief identifier line that includes the patient's name from the transcript is encouraged when the name appears in the dialogue.

Clinical style: concise, professional, past tense where appropriate for HPI.`;

export async function generateSoapNote({ transcript, patientContext }) {
  if (!config.geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the backend.');
  }

  const prompt = `${SYSTEM_PROMPT}

Chart context (demographics and flags for this chart—use for allergies/diagnoses when relevant; for **who the patient is in this visit**, follow the transcript if names differ):
${patientContext}

Consultation transcript (primary source for names and visit dialogue):
${transcript}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    },
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerMessage = payload?.error?.message || 'Gemini request failed.';
    const googleStatus = payload?.error?.status;

    const isQuota =
      response.status === 429 ||
      googleStatus === 'RESOURCE_EXHAUSTED' ||
      /quota exceeded|rate limit|resource_exhausted|free_tier/i.test(providerMessage);

    if (isQuota) {
      throw new AiProviderError(providerMessage, {
        statusCode: 429,
        error: 'QuotaExceeded',
      });
    }

    if (/not found|not supported/i.test(providerMessage)) {
      throw new AiProviderError(
        `${providerMessage} Set GEMINI_MODEL in backend/.env to a model your API key supports (e.g. gemini-2.0-flash or gemini-2.5-flash-preview).`,
        { statusCode: 400, error: 'ModelNotFound' },
      );
    }

    const statusCode =
      response.status >= 400 && response.status < 600 ? response.status : 502;
    throw new AiProviderError(providerMessage, { statusCode, error: 'AiProviderError' });
  }

  const content = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) {
    throw new Error('AI provider returned an empty response.');
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Gemini response could not be parsed as JSON SOAP note.');
  }

  return {
    subjective: String(parsed.subjective || ''),
    objective: String(parsed.objective || ''),
    assessment: String(parsed.assessment || ''),
    plan: String(parsed.plan || ''),
  };
}
