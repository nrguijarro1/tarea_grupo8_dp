const TIPOS = {
  'acceso-no-autorizado': 'Acceso no autorizado',
  malware: 'Malware',
  phishing: 'Phishing',
  vulnerabilidad: 'Vulnerabilidad reportada',
  'fallo-disponibilidad': 'Fallo de disponibilidad'
};

const PRIORIDADES = new Set(['alta', 'media', 'baja']);
const ESTADOS = new Set(['Registrado', 'En revisión', 'En progreso', 'Resuelto', 'Cerrado']);
const { ErrorValidacion } = require('./Errores');

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

function validarDatos(datos, { estadoPredeterminado = false } = {}) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    throw new ErrorValidacion('Datos incompletos');
  }

  const tipo = texto(datos.tipo);
  const fecha = texto(datos.fecha);
  const prioridad = texto(datos.prioridad).toLowerCase();
  const estado = texto(datos.estado) || (estadoPredeterminado ? 'Registrado' : '');
  const descripcion = texto(datos.descripcion);

  if (!tipo || !fecha || !prioridad || !estado || !descripcion) {
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
  if (!ESTADOS.has(estado)) {
    throw new ErrorValidacion('Seleccione un estado válido.');
  }

  const responsableRecibido = texto(datos.responsable);
  if (Object.hasOwn(datos, 'responsable')
    && datos.responsable !== null
    && typeof datos.responsable !== 'string') {
    throw new ErrorValidacion('El responsable debe ser un texto válido.');
  }
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
  if (evidenciaRecibida.length > 200) {
    throw new ErrorValidacion('El nombre de la evidencia no puede superar 200 caracteres.');
  }

  return {
    tipo,
    tipoTexto: TIPOS[tipo],
    fecha,
    prioridad,
    estado,
    responsable: responsableRecibido || 'No especificado',
    descripcion,
    evidencia: evidenciaRecibida || 'Sin evidencia adjunta'
  };
}

function crearIncidente(datos, { id, codigo }) {
  return {
    id,
    codigo,
    ...validarDatos(datos, { estadoPredeterminado: true })
  };
}

function actualizarIncidente(incidenteActual, datos, { parcial = false } = {}) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    throw new ErrorValidacion('Datos incompletos');
  }

  const camposEditables = [
    'tipo',
    'fecha',
    'prioridad',
    'estado',
    'responsable',
    'descripcion',
    'evidencia'
  ];

  if (parcial && !camposEditables.some((campo) => Object.hasOwn(datos, campo))) {
    throw new ErrorValidacion('Proporcione al menos un campo editable.');
  }

  const datosCompletos = parcial
    ? camposEditables.reduce((resultado, campo) => {
      if (Object.hasOwn(datos, campo)) resultado[campo] = datos[campo];
      return resultado;
    }, { ...incidenteActual })
    : datos;

  return {
    id: incidenteActual.id,
    codigo: incidenteActual.codigo,
    ...validarDatos(datosCompletos)
  };
}

module.exports = {
  TIPOS,
  PRIORIDADES,
  ESTADOS,
  crearIncidente,
  actualizarIncidente
};
