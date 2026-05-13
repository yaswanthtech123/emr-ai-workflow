import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { fetchAuditEvents, fetchNotes, fetchPatient, generateSoap, saveNote } from './api';

const emptySoap = {
  subjective: '',
  objective: '',
  assessment: '',
  plan: '',
};

function App() {
  const [role, setRole] = useState('doctor');
  const [patient, setPatient] = useState(null);
  const [visitId, setVisitId] = useState(`visit-${Date.now()}`);
  const [transcript, setTranscript] = useState('');
  const [soapNote, setSoapNote] = useState(emptySoap);
  const [history, setHistory] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadInitial() {
      try {
        setError('');
        const patientResp = await fetchPatient();
        setPatient(patientResp.patient);

        const [notesResp, auditResp] = await Promise.all([
          fetchNotes(patientResp.patient.id),
          fetchAuditEvents(patientResp.patient.id),
        ]);
        setHistory(notesResp.notes);
        setAuditEvents(auditResp.events);
      } catch (err) {
        setError(err.message);
      }
    }

    loadInitial();
  }, []);

  const clinicianWarning = useMemo(
    () =>
      'AI-generated content is a draft only and must be reviewed and edited by a licensed clinician before final use.',
    [],
  );

  function updateSoapField(field, value) {
    setSoapNote((prev) => ({ ...prev, [field]: value }));
  }

  async function handleGenerate() {
    if (!patient) return;

    try {
      setError('');
      setIsGenerating(true);
      const response = await generateSoap({
        patientId: patient.id,
        visitId,
        transcript,
        role,
      });
      setSoapNote(response.generatedNote);

      const auditResp = await fetchAuditEvents(patient.id);
      setAuditEvents(auditResp.events);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSave() {
    if (!patient) return;

    try {
      setError('');
      setIsSaving(true);
      await saveNote({
        patientId: patient.id,
        visitId,
        note: soapNote,
        role,
      });

      const [notesResp, auditResp] = await Promise.all([
        fetchNotes(patient.id),
        fetchAuditEvents(patient.id),
      ]);
      setHistory(notesResp.notes);
      setAuditEvents(auditResp.events);
      setVisitId(`visit-${Date.now()}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="app-shell">
      <h1>AI-Assisted EMR Visit Notes</h1>

      <section className="card">
        <h2>Demo User Role</h2>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="doctor">doctor</option>
          <option value="frontdesk">frontdesk</option>
          <option value="auditor">auditor</option>
        </select>
      </section>

      <section className="card">
        <h2>Patient Context (Synthetic)</h2>
        {patient ? (
          <div>
            <p>
              <strong>Name:</strong> {patient.name}
            </p>
            <p>
              <strong>Age:</strong> {patient.age}
            </p>
            <p>
              <strong>Clinical Detail:</strong> {patient.clinicalDetail}
            </p>
            <p>
              <strong>Visit ID:</strong> {visitId}
            </p>
          </div>
        ) : (
          <p>Loading patient...</p>
        )}
      </section>

      <section className="card">
        <h2>Consultation Transcript</h2>
        <p className="warning">{clinicianWarning}</p>
        <textarea
          rows={7}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Paste synthetic consultation transcript..."
        />
        <button onClick={handleGenerate} disabled={isGenerating || !transcript.trim()}>
          {isGenerating ? 'Generating...' : 'Generate SOAP Note'}
        </button>
      </section>

      <section className="card">
        <h2>Editable SOAP Note</h2>
        {Object.entries(soapNote).map(([key, value]) => (
          <label key={key}>
            {key}
            <textarea
              rows={4}
              value={value}
              onChange={(e) => updateSoapField(key, e.target.value)}
              placeholder={`Enter ${key}...`}
            />
          </label>
        ))}

        <button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Final Note'}
        </button>
      </section>

      {error ? <p className="error">Error: {error}</p> : null}

      <section className="card">
        <h2>Visit Note History</h2>
        {history.length === 0 ? <p>No notes saved yet.</p> : null}
        {history.map((item) => (
          <article key={item.id} className="history-item">
            <p>
              <strong>{item.visitId}</strong> saved at {new Date(item.savedAt).toLocaleString()}
            </p>
            <p>
              <strong>Assessment:</strong> {item.note.assessment}
            </p>
            <p>
              <strong>Plan:</strong> {item.note.plan}
            </p>
          </article>
        ))}
      </section>

      <section className="card">
        <h2>Audit Events</h2>
        {auditEvents.length === 0 ? <p>No audit events yet.</p> : null}
        {auditEvents.map((event) => (
          <article key={event.id} className="history-item">
            <p>
              <strong>{event.eventType}</strong> ({event.userRole})
            </p>
            <p>
              Patient: {event.patientId} | Visit: {event.visitId}
            </p>
            <p>{new Date(event.timestamp).toLocaleString()}</p>
            <p>{event.description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

export default App;
