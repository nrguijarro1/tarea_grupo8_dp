const todayAsISO = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

const validTypes = new Set([
  'acceso-no-autorizado',
  'malware',
  'phishing',
  'vulnerabilidad',
  'fallo-disponibilidad'
]);
const validPriorities = new Set(['alta', 'media', 'baja']);
const validStatuses = new Set(['Registrado', 'En revisión', 'En progreso', 'Resuelto', 'Cerrado']);

const fieldRules = {
  tipo: (field) => validTypes.has(field.value) ? '' : 'Seleccione un tipo de incidente válido.',
  fecha: (field) => {
    if (!field.value) return 'Seleccione la fecha del incidente.';
    if (field.value > todayAsISO()) return 'La fecha no puede estar en el futuro.';
    return '';
  },
  prioridad: (field) => validPriorities.has(field.value) ? '' : 'Seleccione una prioridad válida.',
  estado: (field) => validStatuses.has(field.value) ? '' : 'Seleccione un estado válido.',
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
    this.isSubmitting = false;
    this.editingId = null;
    this.selectedId = null;
  }

  async init() {
    this.view.setMaximumDate(todayAsISO());
    this.view.bindSubmit((event) => this.handleSubmit(event));
    this.view.bindFieldValidation((field) => this.validateField(field));
    this.view.bindIncidentSelection((id) => this.handleSelection(id));
    this.view.bindDetailActions((action, id) => this.handleDetailAction(action, id));
    this.view.bindDescriptionCounter();
    this.view.bindFilters(() => this.renderFilteredIncidents());
    this.view.bindClearFilters(() => this.renderFilteredIncidents());
    this.view.bindCancelEdit(() => this.cancelEdit());

    try {
      const incidents = await this.model.loadIncidents();
      this.renderFilteredIncidents();
      if (incidents[0]) this.selectIncident(incidents[0]);
      this.view.announce(`${incidents.length} incidentes cargados correctamente.`);
    } catch (error) {
      console.error('Error al cargar los incidentes:', error);
      this.view.renderIncidents([], 0);
      this.view.showLoadError('No fue posible cargar los incidentes. Compruebe que el servidor Express esté iniciado.');
      this.view.announce('Error al cargar los incidentes.');
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

  getFilteredIncidents() {
    const filters = this.view.getFilters();
    return this.model.getIncidents().filter((incident) => {
      const searchableText = [
        incident.codigo,
        incident.tipoTexto,
        incident.descripcion,
        incident.responsable
      ].join(' ').toLocaleLowerCase('es');

      return (!filters.busqueda || searchableText.includes(filters.busqueda))
        && (!filters.tipo || incident.tipo === filters.tipo)
        && (!filters.prioridad || incident.prioridad === filters.prioridad)
        && (!filters.estado || incident.estado === filters.estado);
    });
  }

  renderFilteredIncidents() {
    const allIncidents = this.model.getIncidents();
    this.view.renderIncidents(this.getFilteredIncidents(), allIncidents.length);
  }

  async handleSubmit(event) {
    event.preventDefault();
    if (this.isSubmitting) return;

    const errors = this.validateForm();
    this.view.showErrorSummary(errors);

    if (errors.length > 0) {
      this.view.announce(`Formulario con ${errors.length} errores. Revise los campos señalados.`);
      errors[0].field.focus();
      return;
    }

    this.isSubmitting = true;
    const isEditing = this.editingId !== null;
    this.view.setSubmitting(true, isEditing);

    try {
      const current = isEditing ? this.model.getIncidentById(this.editingId) : null;
      const formData = this.view.getFormData(current?.evidencia);
      const incident = isEditing
        ? await this.model.updateIncident(this.editingId, formData)
        : await this.model.createIncident(formData);

      this.selectedId = incident.id;
      this.editingId = null;
      this.view.resetForm();
      this.view.setEditMode(false);
      this.renderFilteredIncidents();
      this.view.renderDetail(incident);
      const successMessage = isEditing
        ? `${incident.codigo} actualizado correctamente.`
        : `${incident.codigo} registrado correctamente con prioridad ${incident.prioridad}.`;
      this.view.showOperationMessage(successMessage);
      this.view.announce(successMessage);
      document.getElementById('detalle').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      console.error('Error al guardar el incidente:', error);
      this.view.showFormError(error.message || 'No fue posible guardar el incidente.');
      this.view.showOperationMessage(error.message || 'No fue posible guardar el incidente.', 'error');
      this.view.announce('No fue posible guardar el incidente.');
    } finally {
      this.isSubmitting = false;
      this.view.setSubmitting(false, this.editingId !== null);
    }
  }

  handleSelection(id) {
    const incident = this.model.getIncidentById(id);
    if (!incident) return;
    this.selectIncident(incident);
    this.view.announce(`Mostrando el detalle de ${incident.codigo}.`);
  }

  selectIncident(incident) {
    this.selectedId = incident.id;
    this.view.renderDetail(incident);
  }

  handleDetailAction(action, id) {
    if (action === 'edit') this.startEdit(id);
    if (action === 'delete') this.deleteIncident(id);
  }

  startEdit(id) {
    const incident = this.model.getIncidentById(id);
    if (!incident) return;
    this.editingId = id;
    this.view.populateForm(incident);
    this.view.setEditMode(true, incident.codigo);
    this.view.announce(`Editando ${incident.codigo}.`);
    document.getElementById('registro').scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.view.focusField(this.view.form.elements.tipo);
  }

  cancelEdit() {
    this.editingId = null;
    this.view.resetForm();
    this.view.setEditMode(false);
    this.view.announce('Edición cancelada.');
  }

  async deleteIncident(id) {
    const incident = this.model.getIncidentById(id);
    if (!incident) return;
    if (!window.confirm(`¿Desea eliminar definitivamente ${incident.codigo}?`)) return;

    try {
      await this.model.deleteIncident(id);
      if (this.editingId === id) this.cancelEdit();
      this.selectedId = null;
      this.renderFilteredIncidents();
      const nextIncident = this.getFilteredIncidents()[0];
      if (nextIncident) this.selectIncident(nextIncident);
      else this.view.clearDetail();
      this.view.showOperationMessage(`${incident.codigo} eliminado correctamente.`);
      this.view.announce(`${incident.codigo} eliminado correctamente.`);
    } catch (error) {
      console.error('Error al eliminar el incidente:', error);
      this.view.showFormError(error.message || 'No fue posible eliminar el incidente.');
      this.view.showOperationMessage(error.message || 'No fue posible eliminar el incidente.', 'error');
      this.view.announce('No fue posible eliminar el incidente.');
    }
  }
}
