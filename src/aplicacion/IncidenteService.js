const { crearIncidente } = require('../dominio/Incidente');

class IncidenteService {
  constructor(repository) {
    this.repository = repository;
    this.registroPendiente = Promise.resolve();
  }

  listar() {
    return this.repository.listar();
  }

  registrar(datos) {
    const operacion = this.registroPendiente.then(async () => {
      const incidentes = await this.repository.listar();
      const mayorCodigo = incidentes.reduce((mayor, incidente) => {
        const numero = Number.parseInt(String(incidente.codigo).replace('INC-', ''), 10);
        return Number.isNaN(numero) ? mayor : Math.max(mayor, numero);
      }, 0);
      const mayorId = incidentes.reduce((mayor, incidente) => {
        const id = Number(incidente.id);
        return Number.isInteger(id) ? Math.max(mayor, id) : mayor;
      }, 0);
      const codigo = `INC-${String(mayorCodigo + 1).padStart(3, '0')}`;
      const incidente = crearIncidente(datos, { id: mayorId + 1, codigo });

      await this.repository.guardarTodos([incidente, ...incidentes]);
      return incidente;
    });

    this.registroPendiente = operacion.catch(() => {});
    return operacion;
  }
}

module.exports = IncidenteService;
