export class IncidentModel {
  constructor(apiUrl = '/api/incidentes') {
    this.apiUrl = apiUrl;
    this.incidents = [];
  }

  async loadIncidents() {
    const response = await fetch(this.apiUrl);

    if (!response.ok) {
      throw new Error(`No fue posible cargar los datos (${response.status}).`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new TypeError('La API no devolvió una lista válida.');
    }

    this.incidents = data.map((incident) => ({ ...incident }));
    return this.getIncidents();
  }

  async createIncident(data) {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    let result;
    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (!response.ok) {
      throw new Error(result?.error || `No fue posible registrar el incidente (${response.status}).`);
    }

    this.incidents.unshift({ ...result });
    return { ...result };
  }

  getIncidents() {
    return this.incidents.map((incident) => ({ ...incident }));
  }

  getIncidentById(id) {
    const incident = this.incidents.find((item) => item.id === Number(id));
    return incident ? { ...incident } : null;
  }
}
