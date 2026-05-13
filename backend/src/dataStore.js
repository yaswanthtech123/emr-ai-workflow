import { promises as fs } from 'fs';
import path from 'path';

const dataDir = path.resolve(process.cwd(), 'data');
const notesFile = path.join(dataDir, 'notes.json');
const auditFile = path.join(dataDir, 'audit-events.json');

async function ensureFile(filePath) {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, '[]', 'utf8');
  }
}

async function readJsonArray(filePath) {
  await ensureFile(filePath);
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content || '[]');
}

async function writeJsonArray(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

export async function getNotes(patientId) {
  const notes = await readJsonArray(notesFile);
  return notes.filter((item) => item.patientId === patientId);
}

export async function saveNote(note) {
  const notes = await readJsonArray(notesFile);
  notes.unshift(note);
  await writeJsonArray(notesFile, notes);
  return note;
}

export async function getAuditEvents(patientId) {
  const events = await readJsonArray(auditFile);
  return events.filter((item) => item.patientId === patientId);
}

export async function addAuditEvent(event) {
  const events = await readJsonArray(auditFile);
  events.unshift(event);
  await writeJsonArray(auditFile, events);
  return event;
}
