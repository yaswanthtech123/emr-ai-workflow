const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.message || data.error || 'Request failed';
    throw new Error(message);
  }

  return data;
}

export function fetchPatient() {
  return request('/patient');
}

export function fetchNotes(patientId) {
  return request(`/notes?patientId=${encodeURIComponent(patientId)}`);
}

export function fetchAuditEvents(patientId) {
  return request(`/audit-events?patientId=${encodeURIComponent(patientId)}`);
}

export function generateSoap({ patientId, visitId, transcript, role }) {
  return request('/ai/generate-soap', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': role,
    },
    body: JSON.stringify({ patientId, visitId, transcript }),
  });
}

export function saveNote({ patientId, visitId, note, role }) {
  return request('/notes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': role,
    },
    body: JSON.stringify({ patientId, visitId, note }),
  });
}
