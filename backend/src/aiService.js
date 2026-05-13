import OpenAI from 'openai';
import { config } from './config.js';

const client = config.openAiApiKey ? new OpenAI({ apiKey: config.openAiApiKey }) : null;

const SYSTEM_PROMPT = `You are assisting a clinician with synthetic data only.
Return a concise SOAP note as strict JSON with keys:
subjective, objective, assessment, plan.
Do not include markdown fences.`;

export async function generateSoapNote({ transcript, patientContext }) {
  if (!client) {
    throw new Error('OPENAI_API_KEY is not configured on the backend.');
  }

  const response = await client.chat.completions.create({
    model: config.model,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Patient context: ${patientContext}\n\nConsultation transcript:\n${transcript}`,
      },
    ],
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AI provider returned an empty response.');
  }

  const parsed = JSON.parse(content);
  return {
    subjective: String(parsed.subjective || ''),
    objective: String(parsed.objective || ''),
    assessment: String(parsed.assessment || ''),
    plan: String(parsed.plan || ''),
  };
}
