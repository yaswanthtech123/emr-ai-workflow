import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { fetchAuditEvents, fetchNotes, fetchPatients, generateSoap, saveNote } from './api';

const emptySoap = {
  subjective: '',
  objective: '',
  assessment: '',
  plan: '',
};

const SOAP_LABELS = {
  subjective: 'Subjective',
  objective: 'Objective',
  assessment: 'Assessment',
  plan: 'Plan',
};

const SAMPLE_TRANSCRIPT = `Doctor: What brings you in today?
Patient: I've had a dry cough for about 10 days and some wheezing when I climb stairs.
Doctor: Any fever, chest pain, or shortness of breath at rest?
Patient: No fever. A little tightness with exertion only.
Doctor: Past medical history includes asthma—are you using your inhaler?
Patient: I used albuterol twice this week with relief.
Doctor: We'll document a mild asthma exacerbation and adjust the plan with follow-up.`;

/** Prefer per-patient `defaultTranscript` from API (`backend/data/patients.json`); else generic sample. */
function transcriptForPatient(p) {
  const custom = p?.defaultTranscript;
  if (typeof custom === 'string' && custom.trim().length >= 20) {
    return custom.trim();
  }
  return SAMPLE_TRANSCRIPT;
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function App() {
  const [role, setRole] = useState('doctor');
  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [patient, setPatient] = useState(null);
  const [visitId, setVisitId] = useState(() => `visit-${Date.now()}`);
  const [transcript, setTranscript] = useState('');
  const [soapNote, setSoapNote] = useState(emptySoap);
  const [history, setHistory] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [sideLoading, setSideLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [sideTab, setSideTab] = useState('history');
  const prevPatientIdRef = useRef(null);
  const transcriptSectionRef = useRef(null);
  /** Counts how many times a new visit ID was started for a patient this session (for banner). */
  const encounterCountByPatientRef = useRef({});
  const [encounterOrdinal, setEncounterOrdinal] = useState(1);
  const [encounterToast, setEncounterToast] = useState('');
  const [visitPillPulse, setVisitPillPulse] = useState(false);
  const encounterToastTimerRef = useRef(0);
  const visitPulseTimerRef = useRef(0);

  useEffect(() => {
    return () => {
      window.clearTimeout(encounterToastTimerRef.current);
      window.clearTimeout(visitPulseTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadPatients() {
      try {
        setPatientsLoading(true);
        setError('');
        const { patients: list } = await fetchPatients();
        if (cancelled) return;
        setPatients(list);
        if (list.length > 0) {
          setPatient(list[0]);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setPatientsLoading(false);
      }
    }
    loadPatients();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!patient?.id) return undefined;
    let cancelled = false;
    (async () => {
      try {
        setSideLoading(true);
        const [notesResp, auditResp] = await Promise.all([
          fetchNotes(patient.id),
          fetchAuditEvents(patient.id),
        ]);
        if (cancelled) return;
        setHistory(notesResp.notes);
        setAuditEvents(auditResp.events);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setSideLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patient?.id]);

  useEffect(() => {
    if (!patient?.id) return undefined;
    const c = encounterCountByPatientRef.current[patient.id] ?? 0;
    setEncounterOrdinal(c + 1);
    return undefined;
  }, [patient?.id]);

  useEffect(() => {
    if (!patient?.id) return undefined;
    const id = patient.id;
    const prev = prevPatientIdRef.current;

    if (prev === null) {
      prevPatientIdRef.current = id;
      setTranscript(transcriptForPatient(patient));
      return undefined;
    }
    if (prev === id) return undefined;

    prevPatientIdRef.current = id;
    setVisitId(`visit-${Date.now()}`);
    setSoapNote(emptySoap);
    setError('');
    setTranscript(transcriptForPatient(patient));
    return undefined;
  }, [patient]);

  const selectPatient = useCallback((p) => {
    setPatient((cur) => (cur?.id === p.id ? cur : p));
  }, []);

  const beginFreshEncounter = useCallback(
    (options = {}) => {
      const { toastMessage, scrollToTranscript = true } = options;
      if (!patient) return;
      const pid = patient.id;
      encounterCountByPatientRef.current[pid] = (encounterCountByPatientRef.current[pid] ?? 0) + 1;
      setEncounterOrdinal(encounterCountByPatientRef.current[pid] + 1);

      setVisitId(`visit-${Date.now()}`);
      setSoapNote(emptySoap);
      setTranscript(transcriptForPatient(patient));
      setError('');

      const msg =
        toastMessage ||
        `Encounter #${encounterCountByPatientRef.current[pid] + 1}: new visit ID, cleared SOAP, transcript reset. Generate when ready.`;
      setEncounterToast(msg);
      window.clearTimeout(encounterToastTimerRef.current);
      encounterToastTimerRef.current = window.setTimeout(() => setEncounterToast(''), 6500);

      setVisitPillPulse(true);
      window.clearTimeout(visitPulseTimerRef.current);
      visitPulseTimerRef.current = window.setTimeout(() => setVisitPillPulse(false), 1400);

      if (scrollToTranscript) {
        queueMicrotask(() => {
          transcriptSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
    },
    [patient],
  );

  const startNewEncounter = useCallback(() => {
    beginFreshEncounter({
      scrollToTranscript: true,
    });
  }, [beginFreshEncounter]);

  const updateSoapField = useCallback((field, value) => {
    setSoapNote((prev) => ({ ...prev, [field]: value }));
  }, []);

  const clinicianWarning = useMemo(
    () =>
      'AI output is a draft only. A licensed clinician must review, edit, and take responsibility before this note is used clinically.',
    [],
  );

  const transcriptChars = transcript.length;
  const canGenerate = transcript.trim().length >= 20 && role === 'doctor';

  const generateHint = useMemo(() => {
    if (!patient) return '';
    if (role !== 'doctor') {
      return 'Choose Clinician (doctor) to enable generation (enforced on the server too).';
    }
    if (transcript.trim().length < 20) {
      return 'Transcript must be at least 20 characters, or click “Insert sample transcript”.';
    }
    return '';
  }, [patient, role, transcript]);

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
      setSideTab('history');
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
      setSideTab('history');
      beginFreshEncounter({
        toastMessage: 'Note saved. New visit ID assigned—draft cleared and transcript reset for the next encounter.',
        scrollToTranscript: false,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  const isDoctor = role === 'doctor';

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <h1 className="brand-title">Visit workspace</h1>
            <p className="brand-sub">Synthetic patients · AI-assisted SOAP · demo only</p>
          </div>
        </div>
        <div className="header-tools">
          <label className="field-inline">
            <span className="field-label">Acting role</span>
            <select
              className="input select-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              aria-label="Demo user role"
            >
              <option value="doctor">Clinician (doctor)</option>
              <option value="frontdesk">Front desk</option>
              <option value="auditor">Auditor</option>
            </select>
          </label>
          {!isDoctor ? (
            <span className="badge badge-warn">Generate / save blocked for this role (backend enforced)</span>
          ) : (
            <span className="badge badge-ok">Clinician actions allowed</span>
          )}
        </div>
      </header>

      {error ? (
        <div className="banner banner-error" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn-ghost" onClick={() => setError('')}>
            Dismiss
          </button>
        </div>
      ) : null}

      {encounterToast ? (
        <div className="banner banner-notice" role="status">
          <span>{encounterToast}</span>
          <button type="button" className="btn btn-ghost" onClick={() => setEncounterToast('')}>
            Dismiss
          </button>
        </div>
      ) : null}

      <main className="app-main">
        <section className="panel panel-patients" aria-labelledby="patients-heading">
          <div className="panel-head">
            <h2 id="patients-heading" className="panel-title">
              Patients
            </h2>
            <p className="panel-desc">All records are synthetic. Select a patient to load context and visit data.</p>
          </div>
          {patientsLoading ? (
            <div className="patient-skeleton-row" aria-busy="true">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton-chip" />
              ))}
            </div>
          ) : (
            <div className="patient-strip" role="listbox" aria-label="Synthetic patients">
              {patients.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={patient?.id === p.id}
                  className={`patient-chip ${patient?.id === p.id ? 'is-active' : ''}`}
                  onClick={() => selectPatient(p)}
                >
                  <span className="patient-avatar" aria-hidden="true">
                    {initials(p.name)}
                  </span>
                  <span className="patient-chip-text">
                    <span className="patient-name">{p.name}</span>
                    <span className="patient-meta">
                      {p.age}y · {p.sex} · {p.mrn}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="layout-split">
          <div className="column-work">
            <div className="note-form-region" data-patient-id={patient?.id ?? ''}>
              <section className="panel panel-note-form" aria-labelledby="note-form-heading">
                <div className="panel-head row-between">
                  <h2 id="note-form-heading" className="panel-title">
                    Visit note
                  </h2>
                  <span className="panel-desc panel-desc-inline">Transcript → AI draft → editable SOAP</span>
                </div>

                {patient ? (
                  <div className="patient-form-banner" key={patient.id}>
                    <div className="patient-form-banner-main">
                      <span className="patient-form-avatar" aria-hidden="true">
                        {initials(patient.name)}
                      </span>
                      <div>
                        <p className="patient-form-title">{patient.name}</p>
                        <p className="patient-form-meta">
                          Age {patient.age} · {patient.sex} · MRN {patient.mrn}
                        </p>
                        <p className="encounter-line">
                          <span className="encounter-badge">Draft encounter #{encounterOrdinal}</span>
                          <span className="encounter-line-muted">this session · not saved until you save the note</span>
                        </p>
                        <p className="patient-form-clinical">
                          <span className="patient-form-clinical-label">Clinical context</span>
                          {patient.clinicalDetail}
                        </p>
                      </div>
                    </div>
                    <div className="patient-form-banner-actions">
                      <p className={`visit-pill visit-pill-tight ${visitPillPulse ? 'is-pulse' : ''}`}>
                        <span className="muted">Visit ID</span> <code>{visitId}</code>
                      </p>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={startNewEncounter}
                        disabled={!patient || isGenerating}
                        title="Assigns a new visit ID, clears SOAP, resets transcript, bumps encounter #, scrolls to transcript, and shows a confirmation banner."
                      >
                        New encounter
                      </button>
                      <p className="visit-action-hint">
                        Same patient, new visit: history and audit stay grouped by each visit ID below.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="patient-form-placeholder">
                    <p>Select a patient above to show their context here and enable the transcript.</p>
                  </div>
                )}

                <div
                  ref={transcriptSectionRef}
                  className="form-subsection form-subsection-transcript"
                  aria-labelledby="tx-heading"
                >
                  <h3 id="tx-heading" className="subsection-title">
                    Consultation transcript
                  </h3>
                  <p className="subsection-desc">Synthetic dialogue only (min. 20 characters to generate).</p>
                  <div className="callout callout-warn">
                    <strong>Clinician responsibility.</strong> {clinicianWarning}
                  </div>
                  <textarea
                    className="input textarea"
                    rows={8}
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder={
                      patient
                        ? `Transcript for ${patient.name} — e.g. Doctor: … Patient: …`
                        : 'Choose a patient first…'
                    }
                    disabled={!patient}
                  />
                  <div className="toolbar">
                    <span className={`char-count ${transcriptChars < 20 ? 'is-low' : ''}`}>
                      {transcriptChars} characters
                    </span>
                    <div className="toolbar-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setTranscript(transcriptForPatient(patient))}
                        disabled={!patient}
                      >
                        Insert sample transcript
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setTranscript('')}
                        disabled={!transcript}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="actions-row">
                    <button
                      type="button"
                      className={`btn btn-primary btn-generate ${isGenerating ? 'is-loading' : ''}`}
                      onClick={handleGenerate}
                      disabled={isGenerating || !patient || !canGenerate}
                      aria-busy={isGenerating}
                    >
                      {isGenerating ? (
                        <>
                          <span className="btn-spinner" aria-hidden="true" />
                          Generating…
                        </>
                      ) : (
                        'Generate SOAP note'
                      )}
                    </button>
                  </div>
                  {generateHint ? <p className="generate-hint">{generateHint}</p> : null}
                </div>

                <div className="form-subsection form-subsection-soap" aria-labelledby="soap-heading">
                  <h3 id="soap-heading" className="subsection-title">
                    SOAP note
                  </h3>
                  <p className="subsection-desc">Draft fills after generate; edit before save.</p>
                  <div className="soap-grid">
                    {Object.entries(soapNote).map(([key, value]) => (
                      <label key={key} className="soap-field">
                        <span className="soap-label">{SOAP_LABELS[key] ?? key}</span>
                        <textarea
                          className="input textarea textarea-compact"
                          rows={5}
                          value={value}
                          onChange={(e) => updateSoapField(key, e.target.value)}
                          placeholder={
                            patient
                              ? `${SOAP_LABELS[key] ?? key} for ${patient.name}…`
                              : `${SOAP_LABELS[key] ?? key}…`
                          }
                          disabled={!patient || isGenerating}
                        />
                      </label>
                    ))}
                  </div>
                  <div className="actions-row">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSave}
                      disabled={isSaving || !patient || !isDoctor || isGenerating}
                    >
                      {isSaving ? 'Saving…' : 'Save final note'}
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <aside className="column-side" aria-label="Visit history and audit">
            <div className="side-tabs" role="tablist" aria-label="Sidebar views">
              <button
                type="button"
                role="tab"
                aria-selected={sideTab === 'history'}
                className={`side-tab ${sideTab === 'history' ? 'is-active' : ''}`}
                onClick={() => setSideTab('history')}
              >
                Saved notes
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sideTab === 'audit'}
                className={`side-tab ${sideTab === 'audit' ? 'is-active' : ''}`}
                onClick={() => setSideTab('audit')}
              >
                Audit trail
              </button>
            </div>

            <div className="side-body">
              {sideLoading ? <p className="muted side-placeholder">Loading…</p> : null}

              {!sideLoading && sideTab === 'history' ? (
                history.length === 0 ? (
                  <p className="muted side-placeholder">No saved notes for this patient yet.</p>
                ) : (
                  <ul className="timeline">
                    {history.map((item) => (
                      <li key={item.id} className="timeline-card">
                        <div className="timeline-meta">
                          <code className="code-sm">{item.visitId}</code>
                          <time dateTime={item.savedAt}>
                            {new Date(item.savedAt).toLocaleString()}
                          </time>
                        </div>
                        <p className="timeline-snippet">
                          <strong>A:</strong> {item.note.assessment}
                        </p>
                        <p className="timeline-snippet">
                          <strong>P:</strong> {item.note.plan}
                        </p>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}

              {!sideLoading && sideTab === 'audit' ? (
                auditEvents.length === 0 ? (
                  <p className="muted side-placeholder">No audit events for this patient yet.</p>
                ) : (
                  <ul className="audit-list">
                    {auditEvents.map((event) => (
                      <li key={event.id} className="audit-row">
                        <div className="audit-type">{event.eventType}</div>
                        <div className="audit-meta">
                          {new Date(event.timestamp).toLocaleString()} · role <strong>{event.userRole}</strong> ·{' '}
                          <code className="code-sm">{event.visitId}</code>
                        </div>
                        <div className="audit-desc">{event.description}</div>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
            </div>
          </aside>
        </div>
      </main>

      <footer className="app-footer">
        <span>Prototype for technical evaluation · not for real clinical use</span>
      </footer>
    </div>
  );
}

export default App;
