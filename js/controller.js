import { todayAsISO, fieldRules, filterIncidents } from './rules.js';

export class IncidentController {
  constructor(model, view) {
    this.model = model;
    this.view = view;
    this.isSubmitting = false;
    this.editingId = null;
    this.selectedId = null;
    this.sessionVersion = 0;
    this.expirationTimer = null;
  }

  init() {
    this.view.setMaximumDate(todayAsISO());
    this.view.bindSubmit((event) => this.handleSubmit(event));
    this.view.bindFieldValidation((field) => this.validateField(field));
    this.view.bindIncidentSelection((id) => this.handleSelection(id));
    this.view.bindDetailActions((action, id) => this.handleDetailAction(action, id));
    this.view.bindDescriptionCounter();
    this.view.bindFilters(() => this.renderFilteredIncidents());
    this.view.bindClearFilters(() => this.renderFilteredIncidents());
    this.view.bindCancelEdit(() => this.cancelEdit());
    document.getElementById('form-login').addEventListener('submit', (event) => this.login(event));
    document.getElementById('boton-logout').addEventListener('click', () => this.logout());
    document.getElementById('form-usuario').addEventListener('submit', (event) => this.createUser(event));
    this.model.onSessionExpired = () => this.logout('Su sesión venció o dejó de ser válida. Inicie sesión nuevamente.');
    this.view.setSession(null);
  }

  async login(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = document.getElementById('boton-login');
    if (button.disabled) return;
    const version = ++this.sessionVersion;
    window.clearTimeout(this.expirationTimer);
    button.disabled = true;
    this.view.showLoginMessage();
    try {
      const user = await this.model.login(form.elements.email.value, form.elements.password.value);
      if (version !== this.sessionVersion) return;
      this.view.setSession(user);
      this.expirationTimer = window.setTimeout(
        () => this.logout('Su sesión venció. Inicie sesión nuevamente.'),
        Math.max(0, this.model.expiresAt - Date.now())
      );
      await this.loadIncidents();
      if (version !== this.sessionVersion) return;
      if (user.rol === 'administrador') await this.loadUsers();
      if (version === this.sessionVersion) document.getElementById('boton-logout').focus();
    } catch (error) {
      if (error.name !== 'AbortError' && version === this.sessionVersion) {
        this.model.clearSession();
        this.view.setSession(null);
        this.view.showLoginMessage(error.message || 'No fue posible iniciar sesión.');
      }
    } finally {
      form.elements.password.value = '';
      button.disabled = false;
    }
  }

  logout(message = '') {
    window.clearTimeout(this.expirationTimer);
    this.sessionVersion++;
    this.model.clearSession();
    this.editingId = null;
    this.selectedId = null;
    this.isSubmitting = false;
    this.view.setSession(null);
    this.view.setSubmitting(false, false);
    this.view.showLoginMessage(message);
    document.getElementById('login-password').value = '';
    document.getElementById('login-email').focus();
  }

  canWrite() {
    return ['administrador', 'analista'].includes(this.model.user?.rol);
  }

  async loadIncidents() {
    const version = this.sessionVersion;
    try {
      const incidents = await this.model.loadIncidents();
      if (version !== this.sessionVersion) return;
      this.view.loading.classList.remove('error-summary');
      this.renderFilteredIncidents();
      if (incidents[0]) this.selectIncident(incidents[0]);
      else this.view.clearDetail();
      this.view.announce(`${incidents.length} incidentes cargados correctamente.`);
    } catch (error) {
      if (error.name === 'AbortError' || version !== this.sessionVersion) return;
      this.view.renderIncidents([], 0);
      this.view.showLoadError(error.message || 'No fue posible cargar los incidentes.');
    }
  }

  async loadUsers() {
    const version = this.sessionVersion;
    try {
      const users = await this.model.getUsers();
      if (version === this.sessionVersion) this.view.renderUsers(users);
    } catch (error) {
      if (error.name !== 'AbortError' && version === this.sessionVersion) {
        this.view.showUserMessage(error.message, true);
      }
    }
  }

  async createUser(event) {
    event.preventDefault();
    if (this.model.user?.rol !== 'administrador') return;
    const form = event.currentTarget;
    const button = document.getElementById('boton-crear-usuario');
    if (button.disabled) return;
    const version = this.sessionVersion;
    button.disabled = true;
    try {
      const user = await this.model.createUser({
        nombre: form.elements.nombre.value.trim(),
        email: form.elements.email.value.trim().toLowerCase(),
        password: form.elements.password.value,
        rol: form.elements.rol.value
      });
      if (version !== this.sessionVersion) return;
      form.reset();
      this.view.showUserMessage(`Usuario ${user.nombre} registrado correctamente.`);
      await this.loadUsers();
    } catch (error) {
      if (error.name !== 'AbortError' && version === this.sessionVersion) {
        this.view.showUserMessage(error.message, true);
      }
    } finally {
      form.elements.password.value = '';
      button.disabled = false;
    }
  }

  validateField(field) {
    const message = fieldRules[field.name]?.(field) || '';
    this.view.showFieldError(field, message);
    return message;
  }

  validateForm() {
    return this.view.fields.map((field) => ({ field, message: this.validateField(field) }))
      .filter(({ message }) => message);
  }

  getFilteredIncidents() {
    return filterIncidents(this.model.getIncidents(), this.view.getFilters());
  }

  renderFilteredIncidents() {
    this.view.renderIncidents(this.getFilteredIncidents(), this.model.getIncidents().length);
  }

  async handleSubmit(event) {
    event.preventDefault();
    if (!this.canWrite() || this.isSubmitting) return;
    const errors = this.validateForm();
    this.view.showErrorSummary(errors);
    if (errors.length) {
      this.view.announce(`Formulario con ${errors.length} errores.`);
      errors[0].field.focus();
      return;
    }
    const version = this.sessionVersion;
    const isEditing = this.editingId !== null;
    this.isSubmitting = true;
    this.view.setSubmitting(true, isEditing);
    let savedIncident = null;
    try {
      const file = this.view.form.elements.evidencia.files[0] || null;
      const data = this.view.getFormData();
      savedIncident = isEditing
        ? await this.model.updateIncident(this.editingId, data)
        : await this.model.createIncident(data);
      if (version !== this.sessionVersion) return;
      // Si falla la carga del archivo, reintentar actualiza este mismo incidente.
      this.editingId = savedIncident.id;
      this.view.setEditMode(true, savedIncident.codigo);
      this.selectIncident(savedIncident);
      this.renderFilteredIncidents();
      if (file) {
        await this.model.uploadEvidence(savedIncident.id, file);
        if (version !== this.sessionVersion) return;
        savedIncident = this.model.getIncidentById(savedIncident.id);
      }
      this.editingId = null;
      this.view.resetForm();
      this.view.setEditMode(false);
      this.renderFilteredIncidents();
      this.selectIncident(savedIncident);
      const message = `${savedIncident.codigo} ${isEditing ? 'actualizado' : 'registrado'} correctamente.`;
      this.view.showOperationMessage(message);
      this.view.announce(message);
      document.getElementById('detalle').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      if (error.name === 'AbortError' || version !== this.sessionVersion) return;
      const message = savedIncident
        ? `${savedIncident.codigo} quedó guardado, pero no se pudo completar la evidencia: ${error.message} Puede reintentar guardando los cambios.`
        : error.message || 'No fue posible guardar el incidente.';
      this.view.showFormError(message);
      this.view.showOperationMessage(message, 'error');
      this.view.announce(message);
    } finally {
      if (version === this.sessionVersion) {
        this.isSubmitting = false;
        this.view.setSubmitting(false, this.editingId !== null);
      }
    }
  }

  handleSelection(id) {
    if (!this.model.user) return;
    const incident = this.model.getIncidentById(id);
    if (incident) this.selectIncident(incident);
  }

  selectIncident(incident) {
    this.selectedId = incident.id;
    this.view.renderDetail(incident);
  }

  async handleDetailAction(action, id) {
    if (!this.model.user) return;
    if (action === 'edit' && this.canWrite()) this.startEdit(id);
    if (action === 'delete' && this.model.user.rol === 'administrador') await this.deleteIncident(id);
    if (action === 'delete-evidence' && this.model.user.rol === 'administrador') {
      await this.deleteEvidence(id);
    }
    if (action === 'evidence') {
      const version = this.sessionVersion;
      try {
        const evidence = await this.model.getEvidenceAccess(id);
        if (version === this.sessionVersion && this.selectedId === id) this.view.showEvidenceAccess(id, evidence);
      } catch (error) {
        if (error.name !== 'AbortError' && version === this.sessionVersion) {
          this.view.showOperationMessage(error.message, 'error');
        }
      }
    }
  }

  startEdit(id) {
    const incident = this.model.getIncidentById(id);
    if (!incident) return;
    this.editingId = id;
    this.view.populateForm(incident);
    this.view.setEditMode(true, incident.codigo);
    document.getElementById('registro').scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.view.focusField(this.view.form.elements.tipo);
  }

  async deleteEvidence(id) {
    if (!window.confirm('¿Desea eliminar la evidencia de este incidente?')) return;
    const version = this.sessionVersion;
    try {
      await this.model.deleteEvidence(id);
      await this.model.loadIncidents();
      if (version !== this.sessionVersion) return;
      this.renderFilteredIncidents();
      if (this.selectedId === id) {
        const incident = this.model.getIncidentById(id);
        if (incident) this.selectIncident(incident);
        else {
          this.selectedId = null;
          this.view.clearDetail();
        }
      }
      this.view.showOperationMessage('Evidencia eliminada correctamente.');
    } catch (error) {
      if (error.name !== 'AbortError' && version === this.sessionVersion) {
        this.view.showOperationMessage(error.message, 'error');
      }
    }
  }

  cancelEdit() {
    this.editingId = null;
    this.view.resetForm();
    this.view.setEditMode(false);
  }

  async deleteIncident(id) {
    const incident = this.model.getIncidentById(id);
    if (!incident || !window.confirm(`¿Desea eliminar definitivamente ${incident.codigo}?`)) return;
    const version = this.sessionVersion;
    try {
      await this.model.deleteIncident(id);
      if (version !== this.sessionVersion) return;
      if (this.editingId === id) this.cancelEdit();
      this.renderFilteredIncidents();
      const next = this.getFilteredIncidents()[0];
      if (next) this.selectIncident(next);
      else {
        this.selectedId = null;
        this.view.clearDetail();
      }
      this.view.showOperationMessage(`${incident.codigo} eliminado correctamente.`);
    } catch (error) {
      if (error.name !== 'AbortError' && version === this.sessionVersion) {
        this.view.showOperationMessage(error.message, 'error');
      }
    }
  }
}
