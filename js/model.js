export class IncidentModel {
  constructor(apiUrl = '/api/incidentes') {
    this.apiUrl = apiUrl;
    this.incidents = [];
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    this.incidents.unshift({ ...result });
    return { ...result };
  }

  async updateIncident(id, data, partial = false) {
    const result = await this.request(`${this.apiUrl}/${id}`, {
      method: partial ? 'PATCH' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const index = this.incidents.findIndex((incident) => incident.id === Number(id));
    if (index !== -1) this.incidents[index] = { ...result };
    return { ...result };
  }

  async deleteIncident(id) {
    await this.request(`${this.apiUrl}/${id}`, { method: 'DELETE' });
    this.incidents = this.incidents.filter((incident) => incident.id !== Number(id));
  }

  async request(url, options = {}) {
    const response = await fetch(url, options);
    let result = null;

    if (response.status !== 204) {
      try {
        result = await response.json();
      } catch {
        result = null;
      }
    }

    if (!response.ok) {
      throw new Error(result?.error || `La solicitud no pudo completarse (${response.status}).`);
    }

    return result;
  }

  getIncidents() {
    return this.incidents.map((incident) => ({ ...incident }));
  }

  getIncidentById(id) {
    const incident = this.incidents.find((item) => item.id === Number(id));
    return incident ? { ...incident } : null;
  }
}
