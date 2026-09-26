class IncidenteRepository {
  constructor(incidentesIniciales = []) {
    if (!Array.isArray(incidentesIniciales)) {
      throw new TypeError('Los incidentes iniciales deben ser un arreglo.');
    }
    this.incidentes = incidentesIniciales.map((incidente) => ({ ...incidente }));
  }

  listar() {
    return this.incidentes.map((incidente) => ({ ...incidente }));
  }

  buscarPorId(id) {
    const incidente = this.incidentes.find((item) => item.id === id);
    return incidente ? { ...incidente } : null;
  }

  crear(incidente) {
    this.incidentes.unshift({ ...incidente });
    return { ...incidente };
  }

  actualizar(id, incidenteActualizado) {
    const indice = this.incidentes.findIndex((item) => item.id === id);
    if (indice === -1) return null;
    this.incidentes[indice] = { ...incidenteActualizado };
    return { ...this.incidentes[indice] };
  }

  eliminar(id) {
    const indice = this.incidentes.findIndex((item) => item.id === id);
    if (indice === -1) return false;
    this.incidentes.splice(indice, 1);
    return true;
  }
}

module.exports = IncidenteRepository;
