const { crearIncidente, actualizarIncidente } = require('../dominio/Incidente');
const { ErrorValidacion, ErrorNoEncontrado } = require('../dominio/Errores');

class IncidenteService {
  constructor(repository) {
    this.repository = repository;
  }

  listar() {
    return this.repository.listar();
  }

  buscarPorId(idRecibido) {
    const id = this.validarId(idRecibido);
    const incidente = this.repository.buscarPorId(id);
    if (!incidente) throw new ErrorNoEncontrado();
    return incidente;
  }

  registrar(datos) {
    const incidentes = this.repository.listar();
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

    return this.repository.crear(incidente);
  }

  reemplazar(idRecibido, datos) {
    return this.modificar(idRecibido, datos, false);
  }

  actualizarParcialmente(idRecibido, datos) {
    return this.modificar(idRecibido, datos, true);
  }

  modificar(idRecibido, datos, parcial) {
    const actual = this.buscarPorId(idRecibido);
    const actualizado = actualizarIncidente(actual, datos, { parcial });
    return this.repository.actualizar(actual.id, actualizado);
  }

  eliminar(idRecibido) {
    const incidente = this.buscarPorId(idRecibido);
    this.repository.eliminar(incidente.id);
  }

  validarId(idRecibido) {
    const id = Number(idRecibido);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ErrorValidacion('El identificador del incidente no es válido.');
    }
    return id;
  }
}

module.exports = IncidenteService;
