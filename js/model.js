export class IncidentModel {
  constructor(apiUrl = '/api/incidentes') {
    this.apiUrl = apiUrl;
    this.incidents = [];
    this.token = null;
    this.user = null;
    this.expiresAt = null;
    this.abortController = new AbortController();
    this.onSessionExpired = null;
  }

  clearSession() {
    this.abortController.abort();
    this.abortController = new AbortController();
    this.token = null;
    this.user = null;
    this.expiresAt = null;
    this.incidents = [];
  }

  async login(email, password) {
    this.clearSession();
    const session = await this.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password })
    }, false);
    if (!session?.access_token) throw new Error('La API no devolvió una sesión válida.');
    this.token = session.access_token;
    this.expiresAt = Date.now() + session.expires_in * 1000;
    try {
      this.user = await this.request('/api/auth/me');
      return { ...this.user };
    } catch (error) {
      this.clearSession();
      throw error;
    }
  }

  async getUsers() {
    return this.request('/api/auth/usuarios');
  }

  async createUser(data) {
    return this.request('/api/auth/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  }

  async loadIncidents() {
    const data = await this.request(this.apiUrl);

    if (!Array.isArray(data)) {
      throw new TypeError('La API no devolvió una lista válida.');
    }

    this.incidents = data.map((incident) => ({ ...incident }));
    return this.getIncidents();
  }

  async createIncident(data) {
    const result = await this.request(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    this.incidents.unshift({ ...result });

    return { ...result };
  }

  async updateIncident(id, data, partial = false) {
    const result = await this.request(
      `${this.apiUrl}/${id}`,
      {
        method: partial ? 'PATCH' : 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      }
    );

    const index = this.incidents.findIndex(
      (incident) => incident.id === Number(id)
    );

    if (index !== -1) {
      this.incidents[index] = { ...result };
    }

    return { ...result };
  }

  async deleteIncident(id) {
    await this.request(
      `${this.apiUrl}/${id}`,
      {
        method: 'DELETE'
      }
    );

    this.incidents = this.incidents.filter(
      (incident) => incident.id !== Number(id)
    );
  }

  // ==============================
  // EVIDENCIAS
  // ==============================

  async uploadEvidence(id, file) {
    if (!(file instanceof File)) {
      throw new TypeError(
        'Debe seleccionar un archivo válido.'
      );
    }

    const formData = new FormData();

    formData.append('archivo', file);

    const result = await this.request(
      `${this.apiUrl}/${id}/evidencia`,
      {
        method: 'POST',
        body: formData
      }
    );
    const incident = this.incidents.find((item) => item.id === Number(id));
    if (incident && result?.evidencia?.nombre_original) {
      incident.evidencia = result.evidencia.nombre_original;
    }
    return result;
  }

  async getEvidenceAccess(id) {
    return this.request(
      `${this.apiUrl}/${id}/evidencia/acceso`
    );
  }

  async deleteEvidence(id) {
    await this.request(
      `${this.apiUrl}/${id}/evidencia`,
      {
        method: 'DELETE'
      }
    );
  }

  // ==============================
  // HTTP
  // ==============================

  async request(url, options = {}, authenticated = true) {
    const headers = new Headers(options.headers);
    const token = this.token;
    if (authenticated && token) headers.set('Authorization', `Bearer ${token}`);
    const signal = this.abortController.signal;
    const response = await fetch(url, { ...options, headers, signal, cache: 'no-store' });

    let result = null;

    if (response.status !== 204) {
      try {
        result = await response.json();
      } catch {
        result = null;
      }
    }

    if (signal.aborted) throw new DOMException('Solicitud cancelada.', 'AbortError');

    if (!response.ok) {
      if (response.status === 401 && authenticated && token === this.token) {
        this.clearSession();
        this.onSessionExpired?.();
      }
      const message = result?.error || result?.detail;
      const error = new Error(typeof message === 'string' ? message
        : `La solicitud no pudo completarse (${response.status}).`);
      error.status = response.status;
      throw error;
    }

    return result;
  }

  // ==============================
  // ESTADO LOCAL
  // ==============================

  getIncidents() {
    return this.incidents.map(
      (incident) => ({ ...incident })
    );
  }

  getIncidentById(id) {
    const incident = this.incidents.find(
      (item) => item.id === Number(id)
    );

    return incident
      ? { ...incident }
      : null;
  }
}
