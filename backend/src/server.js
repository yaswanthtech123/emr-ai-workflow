import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { config } from './config.js';
import { syntheticPatient } from './patient.js';
import { attachRole, requireDoctorRole } from './middleware.js';
import { addAuditEvent, getAuditEvents, getNotes, saveNote } from './dataStore.js';
import { generateSoapNote } from './aiService.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(attachRole);

const transcriptSchema = z.object({
  patientId: z.string().min(1),
  visitId: z.string().min(1),
  transcript: z.string().min(20, 'Transcript is too short for SOAP generation.'),
});

const noteSchema = z.object({
  patientId: z.string().min(1),
  visitId: z.string().min(1),
  note: z.object({
    subjective: z.string().min(1),
    objective: z.string().min(1),
    assessment: z.string().min(1),
    plan: z.string().min(1),
  }),
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/patient', (_req, res) => {
  res.json({ patient: syntheticPatient });
});

app.post('/api/ai/generate-soap', requireDoctorRole, async (req, res, next) => {
  try {
    const payload = transcriptSchema.parse(req.body);

    if (payload.patientId !== syntheticPatient.id) {
      return res.status(404).json({ error: 'Patient not found.' });
    }

    const patientContext = `${syntheticPatient.name}, age ${syntheticPatient.age}, ${syntheticPatient.clinicalDetail}`;
    const generatedNote = await generateSoapNote({
      transcript: payload.transcript,
      patientContext,
    });

    const auditEvent = {
      id: crypto.randomUUID(),
      eventType: 'AI_NOTE_GENERATED',
      patientId: payload.patientId,
      visitId: payload.visitId,
      userRole: req.userRole,
      timestamp: new Date().toISOString(),
      description: 'Generated draft SOAP note from synthetic transcript.',
    };
    await addAuditEvent(auditEvent);

    return res.json({ generatedNote });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/notes', requireDoctorRole, async (req, res, next) => {
  try {
    const payload = noteSchema.parse(req.body);

    if (payload.patientId !== syntheticPatient.id) {
      return res.status(404).json({ error: 'Patient not found.' });
    }

    const noteRecord = {
      id: crypto.randomUUID(),
      patientId: payload.patientId,
      visitId: payload.visitId,
      note: payload.note,
      savedAt: new Date().toISOString(),
      savedByRole: req.userRole,
    };

    await saveNote(noteRecord);
    await addAuditEvent({
      id: crypto.randomUUID(),
      eventType: 'FINAL_NOTE_SAVED',
      patientId: payload.patientId,
      visitId: payload.visitId,
      userRole: req.userRole,
      timestamp: new Date().toISOString(),
      description: 'Saved clinician-reviewed final SOAP note.',
    });

    return res.status(201).json({ note: noteRecord });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/notes', async (req, res, next) => {
  try {
    const patientId = req.query.patientId;
    if (typeof patientId !== 'string' || patientId.length === 0) {
      return res.status(400).json({ error: 'patientId query parameter is required.' });
    }

    const notes = await getNotes(patientId);
    return res.json({ notes });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/audit-events', async (req, res, next) => {
  try {
    const patientId = req.query.patientId;
    if (typeof patientId !== 'string' || patientId.length === 0) {
      return res.status(400).json({ error: 'patientId query parameter is required.' });
    }

    const events = await getAuditEvents(patientId);
    return res.json({ events });
  } catch (error) {
    return next(error);
  }
});

app.use((err, _req, res, _next) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      error: 'ValidationError',
      details: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }

  console.error(err);
  return res.status(500).json({
    error: 'InternalServerError',
    message: err.message || 'Unexpected server error',
  });
});

app.listen(config.port, () => {
  console.log(`Backend listening on http://localhost:${config.port}`);
});
