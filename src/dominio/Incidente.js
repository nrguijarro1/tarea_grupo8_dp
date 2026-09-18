const TIPOS = {
  'acceso-no-autorizado': 'Acceso no autorizado',
  malware: 'Malware',
  phishing: 'Phishing',
  vulnerabilidad: 'Vulnerabilidad reportada'
};

const PRIORIDADES = new Set(['alta', 'media', 'baja']);

class ErrorValidacion extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorValidacion';
  }
}

function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function fechaValida(fecha) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const fechaUtc = new Date(`${fecha}T00:00:00Z`);
  return !Number.isNaN(fechaUtc.getTime())
    && fechaUtc.toISOString().slice(0, 10) === fecha;
}

function fechaActualISO() {
  const ahora = new Date();
  const desfase = ahora.getTimezoneOffset() * 60_000;
  return new Date(ahora.getTime() - desfase).toISOString().slice(0, 10);
}

function crearIncidente(datos, { id, codigo }) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    throw new ErrorValidacion('Datos incompletos');
  }

  const tipo = texto(datos.tipo);
  const fecha = texto(datos.fecha);
  const prioridad = texto(datos.prioridad).toLowerCase();
  const descripcion = texto(datos.descripcion);

  if (!tipo || !fecha || !prioridad || !descripcion) {
    throw new ErrorValidacion('Datos incompletos');
  }
  if (!Object.hasOwn(TIPOS, tipo)) {
    throw new ErrorValidacion('Seleccione un tipo de incidente válido.');
  }
  if (!fechaValida(fecha)) {
    throw new ErrorValidacion('Ingrese una fecha válida.');
  }
  if (fecha > fechaActualISO()) {
    throw new ErrorValidacion('La fecha no puede estar en el futuro.');
  }
  if (!PRIORIDADES.has(prioridad)) {
    throw new ErrorValidacion('Seleccione una prioridad válida.');
  }

  const responsableRecibido = texto(datos.responsable);
  if (responsableRecibido && responsableRecibido.length < 3) {
    throw new ErrorValidacion('El responsable debe tener al menos 3 caracteres.');
  }
  if (responsableRecibido.length > 80) {
    throw new ErrorValidacion('El responsable no puede superar 80 caracteres.');
  }
  if (descripcion.length < 30 || descripcion.length > 600) {
    throw new ErrorValidacion('La descripción debe tener entre 30 y 600 caracteres.');
  }

  const evidenciaRecibida = texto(datos.evidencia);

  return {
    id,
    codigo,
    tipo,
    tipoTexto: TIPOS[tipo],
    fecha,
    prioridad,
    estado: 'Registrado',
    responsable: responsableRecibido || 'No especificado',
    descripcion,
    evidencia: evidenciaRecibida || 'Sin evidencia adjunta'
  };
}

module.exports = { crearIncidente, ErrorValidacion };
