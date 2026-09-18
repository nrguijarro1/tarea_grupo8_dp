export class IncidentModel {
  constructor(dataUrl) {
    this.dataUrl = dataUrl;
    this.incidents = [];
  }

  async loadIncidents() {
    const response = await fetch(this.dataUrl);

    if (!response.ok) {
      throw new Error(`No fue posible cargar los datos (${response.status}).`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new TypeError('El archivo JSON no contiene una lista válida.');
    }

    this.incidents = data.map((incident) => ({ ...incident }));
    return this.getIncidents();
  }

  getIncidents() {
    return this.incidents.map((incident) => ({ ...incident }));
  }

  getIncidentById(id) {
    const incident = this.incidents.find((item) => item.id === Number(id));
    return incident ? { ...incident } : null;
  }

  addIncident(data) {
    const nextId = this.incidents.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    const incident = {
      id: nextId,
      codigo: `INC-${String(nextId).padStart(3, '0')}`,
      estado: 'Registrado',
      ...data
    };

    this.incidents.unshift(incident);
    return { ...incident };
  }
}
