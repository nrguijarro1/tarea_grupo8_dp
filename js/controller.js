const todayAsISO = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

const fieldRules = {
  tipo: (field) => field.value ? '' : 'Seleccione un tipo de incidente.',
  fecha: (field) => {
    if (!field.value) return 'Seleccione la fecha del incidente.';
    if (field.value > todayAsISO()) return 'La fecha no puede estar en el futuro.';
    return '';
  },
  prioridad: (field) => field.value ? '' : 'Seleccione la prioridad del incidente.',
  responsable: (field) => {
    const value = field.value.trim();
    if (value && value.length < 3) return 'Escriba al menos 3 caracteres o deje el campo vacío.';
    return '';
  },
  descripcion: (field) => {
    const length = field.value.trim().length;
    if (length === 0) return 'Describa el incidente.';
    if (length < 30) return `Faltan ${30 - length} caracteres para completar la descripción.`;
    return '';
  },
  evidencia: (field) => {
    const file = field.files[0];
    if (!file) return '';

    const allowedExtensions = ['png', 'jpg', 'jpeg', 'pdf'];
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!allowedExtensions.includes(extension)) return 'Use un archivo PNG, JPG o PDF.';
    if (file.size > 5 * 1024 * 1024) return 'El archivo no debe superar los 5 MB.';
    return '';
  }
};

export class IncidentController {
  constructor(model, view) {
    this.model = model;
    this.view = view;
  }

  async init() {
    this.view.setMaximumDate(todayAsISO());
    this.view.bindSubmit((event) => this.handleSubmit(event));
    this.view.bindFieldValidation((field) => this.validateField(field));
    this.view.bindIncidentSelection((id) => this.handleSelection(id));
    this.view.bindDescriptionCounter();

    try {
      const incidents = await this.model.loadIncidents();
      this.view.renderIncidents(incidents);
      if (incidents[0]) this.view.renderDetail(incidents[0]);
      this.view.announce(`${incidents.length} incidentes simulados cargados correctamente.`);
    } catch (error) {
      console.error('Error al cargar los incidentes:', error);
      this.view.renderIncidents([]);
      this.view.showLoadError('No fue posible cargar los incidentes. Inicie el proyecto mediante un servidor local.');
      this.view.announce('Error al cargar los incidentes simulados.');
    }
  }

  validateField(field) {
    const validate = fieldRules[field.name];
    const message = validate ? validate(field) : '';
    this.view.showFieldError(field, message);
    return message;
  }

  validateForm() {
    return this.view.fields
      .map((field) => ({ field, message: this.validateField(field) }))
      .filter(({ message }) => message);
  }

  handleSubmit(event) {
    event.preventDefault();
    const errors = this.validateForm();
    this.view.showErrorSummary(errors);

    if (errors.length > 0) {
      this.view.announce(`Formulario con ${errors.length} errores. Revise los campos señalados.`);
      errors[0].field.focus();
      return;
    }

    const incident = this.model.addIncident(this.view.getFormData());
    this.view.renderIncidents(this.model.getIncidents());
    this.view.renderDetail(incident);
    this.view.resetForm();
    this.view.announce(`${incident.codigo} registrado correctamente con prioridad ${incident.prioridad}.`);
    document.getElementById('detalle').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  handleSelection(id) {
    const incident = this.model.getIncidentById(id);
    if (!incident) return;

    this.view.renderDetail(incident);
    this.view.announce(`Mostrando el detalle de ${incident.codigo}.`);
  }
}
