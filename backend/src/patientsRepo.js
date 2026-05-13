import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '../data/patients.json');

/** @type {Array<{id:string,name:string,age:number,sex:string,mrn:string,clinicalDetail:string}>} */
const patients = JSON.parse(readFileSync(filePath, 'utf8'));

const byId = new Map(patients.map((p) => [p.id, p]));

export function listPatients() {
  return patients;
}

export function getPatientById(id) {
  return byId.get(id) ?? null;
}

export function patientContextLine(patient) {
  return `${patient.name}, age ${patient.age}, ${patient.sex}, MRN ${patient.mrn}. ${patient.clinicalDetail}`;
}
