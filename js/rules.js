export const todayAsISO = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;

  return new Date(now.getTime() - offset)
    .toISOString()
    .slice(0, 10);
};


const validTypes = new Set([
  'acceso-no-autorizado',
  'malware',
  'phishing',
  'vulnerabilidad',
  'fallo-disponibilidad'
]);


const validPriorities = new Set([
  'alta',
  'media',
  'baja'
]);


const validStatuses = new Set([
  'Registrado',
  'En revisión',
  'En progreso',
  'Resuelto',
  'Cerrado'
]);


export const fieldRules = {

  tipo: (field) =>
    validTypes.has(field.value)
      ? ''
      : 'Seleccione un tipo de incidente válido.',


  fecha: (field) => {

    if (!field.value) {
      return 'Seleccione la fecha del incidente.';
    }

    if (field.value > todayAsISO()) {
      return 'La fecha no puede estar en el futuro.';
    }

    return '';
  },


  prioridad: (field) =>
    validPriorities.has(field.value)
      ? ''
      : 'Seleccione una prioridad válida.',


  estado: (field) =>
    validStatuses.has(field.value)
      ? ''
      : 'Seleccione un estado válido.',


  responsable: (field) => {

    const value = field.value.trim();

    if (value && (value.length < 3 || value.length > 80)) {
      return 'Escriba entre 3 y 80 caracteres o deje el campo vacío.';
    }

    return '';
  },


  descripcion: (field) => {

    // Se permiten tabulaciones y saltos de línea, igual que en el backend.
    if (/\p{C}/u.test(field.value.replace(/[\r\n\t]/g, ''))) {
      return 'La descripción contiene caracteres de control no permitidos.';
    }

    const length = field.value.trim().length;

    if (length === 0) {
      return 'Describa el incidente.';
    }

    if (length < 30) {
      return `Faltan ${30 - length} caracteres para completar la descripción.`;
    }

    if (length > 600) return 'La descripción no puede superar 600 caracteres.';

    return '';
  },


  evidencia: (field) => {

    const file = field.files[0];

    if (!file) {
      return '';
    }

    const allowedExtensions = [
      'png',
      'jpg',
      'jpeg',
      'pdf'
    ];

    const extension = file.name
      .split('.')
      .pop()
      ?.toLowerCase();


    if (!allowedExtensions.includes(extension)) {
      return 'Use un archivo PNG, JPG o PDF.';
    }


    if (file.size > 5 * 1024 * 1024) {
      return 'El archivo no debe superar los 5 MB.';
    }

    if (file.size === 0) return 'El archivo está vacío.';


    return '';
  }
};

/** Filtra registros sin modificar la colección conservada por el modelo. */
export const filterIncidents = (incidents, filters) => incidents.filter((incident) => {
  const text = [incident.codigo, incident.tipoTexto, incident.descripcion, incident.responsable]
    .join(' ').toLocaleLowerCase('es');
  return (!filters.busqueda || text.includes(filters.busqueda))
    && (!filters.tipo || incident.tipo === filters.tipo)
    && (!filters.prioridad || incident.prioridad === filters.prioridad)
    && (!filters.estado || incident.estado === filters.estado);
});
