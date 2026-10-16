const priorityClasses = {
  alta: 'high',
  media: 'medium',
  baja: 'low'
};

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

const formatDate = (date) => {
  if (!date) return 'Fecha no especificada';

  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime())) return 'Fecha no especificada';

  return new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'long',
    timeZone: 'UTC'
  }).format(parsedDate);
};

const createElement = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

export class IncidentView {
  constructor() {
    this.form = document.getElementById('form-incidente');
    this.list = document.getElementById('lista-incidentes');
    this.detail = document.getElementById('detalle-contenido');
    this.loading = document.getElementById('estado-carga');
    this.liveRegion = document.getElementById('anuncios');
    this.errorSummary = document.getElementById('resumen-errores');
    this.total = document.getElementById('total-incidentes');
    this.descriptionCounter = document.getElementById('contador-descripcion');
    this.formTitle = document.getElementById('titulo-registro');
    this.saveButton = document.getElementById('boton-guardar');
    this.cancelEditButton = document.getElementById('boton-cancelar-edicion');
    this.filterForm = document.getElementById('form-filtros');
    this.clearFiltersButton = document.getElementById('boton-limpiar-filtros');
    this.filterSummary = document.getElementById('resumen-filtros');
    this.operationMessage = document.getElementById('mensaje-operacion');
    this.fields = [...this.form.elements].filter((element) => element.name);
    this.role = null;
  }

  setMaximumDate(date) {
    this.form.elements.fecha.max = date;
  }

  setSession(user) {
    this.role = user?.rol || null;
    document.getElementById('pantalla-login').hidden = Boolean(user);
    document.getElementById('aplicacion').hidden = !user;
    document.getElementById('nombre-usuario').textContent = user?.nombre || '—';
    document.getElementById('rol-usuario').textContent = user?.rol || '—';
    const canWrite = ['administrador', 'analista'].includes(this.role);
    document.getElementById('registro').hidden = !canWrite;
    document.querySelector('.site-nav a[href="#registro"]').hidden = !canWrite;
    document.getElementById('panel-usuarios').hidden = this.role !== 'administrador';
    document.getElementById('nav-usuarios').hidden = this.role !== 'administrador';
    document.getElementById('enlace-saltar').href = user ? '#contenido-principal' : '#pantalla-login';
    this.clearDetail();
    this.renderIncidents([], 0);
    this.resetForm();
    this.setEditMode(false);
    this.filterForm.reset();
    this.operationMessage.hidden = true;
    document.getElementById('form-usuario').reset();
    document.getElementById('mensaje-usuarios').hidden = true;
    document.getElementById('estado-usuarios').textContent = '';
    document.getElementById('lista-usuarios').replaceChildren();
    this.liveRegion.textContent = '';
  }

  showLoginMessage(message = '') {
    const element = document.getElementById('mensaje-login');
    element.textContent = message;
    element.hidden = !message;
  }

  showUserMessage(message, error = false) {
    const element = document.getElementById('mensaje-usuarios');
    element.textContent = message;
    element.classList.toggle('error', error);
    element.hidden = false;
  }

  renderUsers(users) {
    const table = createElement('table');
    table.append(createElement('caption', 'sr-only', 'Usuarios registrados'));
    const head = createElement('thead');
    const header = createElement('tr');
    ['Nombre', 'Correo', 'Rol', 'Estado'].forEach((label) => {
      const cell = createElement('th', '', label);
      cell.scope = 'col';
      header.append(cell);
    });
    head.append(header);
    const body = createElement('tbody');
    users.forEach((user) => {
      const row = createElement('tr');
      [user.nombre, user.email, user.rol, user.activo ? 'Activo' : 'Inactivo']
        .forEach((value) => row.append(createElement('td', '', value)));
      body.append(row);
    });
    table.append(head, body);
    document.getElementById('lista-usuarios').replaceChildren(table);
    document.getElementById('estado-usuarios').textContent = `${users.length} usuarios registrados.`;
  }

  showEvidenceAccess(id, evidence) {
    const paragraph = this.detail.querySelector('[data-evidence-id]');
    if (!paragraph || Number(paragraph.dataset.evidenceId) !== id) return;
    const url = new URL(evidence.url);
    const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.protocol !== 'https:' && !localHttp) throw new Error('La URL de evidencia no es segura.');
    const link = createElement('a', '', `Abrir ${evidence.nombre}`);
    link.href = url.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    paragraph.replaceChildren(link, createElement('small', '', ' Enlace temporal: 10 minutos.'));
  }

  bindSubmit(handler) {
    this.form.addEventListener('submit', handler);
  }

  bindFieldValidation(handler) {
    this.fields.forEach((field) => {
      const eventName = field.type === 'file' || field.tagName === 'SELECT' ? 'change' : 'input';
      field.addEventListener(eventName, () => handler(field));
      field.addEventListener('blur', () => handler(field));
    });
  }

  bindIncidentSelection(handler) {
    this.list.addEventListener('click', (event) => {
      const button = event.target.closest('[data-incident-id]');
      if (button) handler(Number(button.dataset.incidentId));
    });
  }

  bindDetailActions(handler) {
    this.detail.addEventListener('click', (event) => {
      const button = event.target.closest('[data-detail-action]');
      if (button) handler(button.dataset.detailAction, Number(button.dataset.incidentId));
    });
  }

  bindFilters(handler) {
    this.filterForm.addEventListener('input', handler);
    this.filterForm.addEventListener('change', handler);
    this.filterForm.addEventListener('submit', (event) => event.preventDefault());
  }

  bindClearFilters(handler) {
    this.clearFiltersButton.addEventListener('click', () => {
      this.filterForm.reset();
      handler();
    });
  }

  bindCancelEdit(handler) {
    this.cancelEditButton.addEventListener('click', handler);
  }

  bindDescriptionCounter() {
    this.form.elements.descripcion.addEventListener('input', (event) => {
      this.descriptionCounter.textContent = `${event.target.value.length}/600`;
    });
  }

  getFormData() {
    const values = new FormData(this.form);

    return {
      tipo: values.get('tipo'),
      fecha: values.get('fecha'),
      prioridad: values.get('prioridad'),
      estado: values.get('estado'),
      responsable: values.get('responsable').trim() || null,
      descripcion: values.get('descripcion').trim()
    };
  }

  getFilters() {
    const values = new FormData(this.filterForm);
    return {
      busqueda: String(values.get('busqueda') || '').trim().toLocaleLowerCase('es'),
      tipo: String(values.get('tipo') || ''),
      prioridad: String(values.get('prioridad') || ''),
      estado: String(values.get('estado') || '')
    };
  }

  renderIncidents(incidents, totalCount = incidents.length) {
    this.list.replaceChildren();
    this.loading.hidden = true;

    if (incidents.length === 0) {
      const empty = createElement('div', 'empty-state');
      empty.append(createElement('p', '', 'No hay incidentes para mostrar.'));
      this.list.append(empty);
    } else {
      const fragment = document.createDocumentFragment();
      incidents.forEach((incident) => fragment.append(this.createIncidentCard(incident)));
      this.list.append(fragment);
    }

    const hayFiltros = incidents.length !== totalCount;
    this.total.textContent = hayFiltros ? `${incidents.length}/${totalCount}` : incidents.length;
    this.total.setAttribute('aria-label', `${incidents.length} de ${totalCount} incidentes visibles`);
    this.filterSummary.textContent = hayFiltros
      ? `${incidents.length} de ${totalCount} incidentes coinciden con los filtros.`
      : `${totalCount} incidentes registrados.`;
  }

  createIncidentCard(incident) {
    const article = createElement('article', `incident ${priorityClasses[incident.prioridad] || ''}`);
    const button = createElement('button');
    button.type = 'button';
    button.dataset.incidentId = incident.id;
    button.setAttribute('aria-label', `Ver detalle de ${incident.codigo}: ${incident.tipoTexto}`);
    button.append(
      createElement('h3', '', `${incident.codigo}: ${incident.tipoTexto}`),
      createElement('p', '', `${formatDate(incident.fecha)} · Estado: ${incident.estado}`),
      createElement('span', 'badge', `Prioridad ${capitalize(incident.prioridad)}`)
    );
    article.append(button);
    return article;
  }

  createEvidenceLink(fileName, id) {
    const paragraph = createElement('p', '', 'Evidencia: ');
    paragraph.dataset.evidenceId = id;
    const safeName = String(fileName).trim();

    if (!safeName || safeName === 'Sin evidencia adjunta') {
      paragraph.textContent = 'Evidencia: Sin evidencia adjunta';
      return paragraph;
    }

    const button = createElement('button', 'button-secondary', safeName);
    button.type = 'button';
    button.dataset.detailAction = 'evidence';
    button.dataset.incidentId = id;
    paragraph.append(button);
    return paragraph;
  }

  renderDetail(incident) {
    this.detail.className = '';
    this.detail.replaceChildren();

    const title = createElement('h3', '', `${incident.codigo}: ${incident.tipoTexto}`);
    const dataList = createElement('dl', 'detail-grid');
    const details = [
      ['Fecha', formatDate(incident.fecha)],
      ['Prioridad', capitalize(incident.prioridad)],
      ['Estado', incident.estado],
      ['Responsable', incident.responsable]
    ];

    details.forEach(([term, value]) => {
      const group = createElement('div');
      group.append(createElement('dt', '', term), createElement('dd', '', value));
      dataList.append(group);
    });

    const description = createElement('p', 'detail-description', incident.descripcion);
    const evidence = this.createEvidenceLink(incident.evidencia, incident.id);
    const actions = createElement('div', 'detail-actions');
    const editButton = createElement('button', 'button-secondary', 'Editar incidente');
    editButton.type = 'button';
    editButton.dataset.detailAction = 'edit';
    editButton.dataset.incidentId = incident.id;
    const deleteButton = createElement('button', 'button-danger', 'Eliminar incidente');
    deleteButton.type = 'button';
    deleteButton.dataset.detailAction = 'delete';
    deleteButton.dataset.incidentId = incident.id;
    if (['administrador', 'analista'].includes(this.role)) actions.append(editButton);
    if (this.role === 'administrador') actions.append(deleteButton);
    if (this.role === 'administrador' && incident.evidencia !== 'Sin evidencia adjunta') {
      const removeEvidence = createElement('button', 'button-danger', 'Eliminar evidencia');
      removeEvidence.type = 'button';
      removeEvidence.dataset.detailAction = 'delete-evidence';
      removeEvidence.dataset.incidentId = incident.id;
      actions.append(removeEvidence);
    }
    this.detail.append(title, dataList, description, evidence, actions);
  }

  clearDetail() {
    this.detail.className = 'empty-state';
    this.detail.replaceChildren(
      createElement('p', '', 'Seleccione un incidente del listado para consultar toda su información.')
    );
  }

  populateForm(incident) {
    ['tipo', 'fecha', 'prioridad', 'estado', 'responsable', 'descripcion'].forEach((field) => {
      this.form.elements[field].value = incident[field] === 'No especificado'
        ? ''
        : incident[field];
    });
    this.form.elements.evidencia.value = '';
    this.descriptionCounter.textContent = `${incident.descripcion.length}/600`;
    this.fields.forEach((field) => this.showFieldError(field, ''));
    this.showErrorSummary([]);
  }

  setEditMode(isEditing, codigo = '') {
    this.formTitle.textContent = isEditing ? `Editar ${codigo}` : 'Registrar incidente';
    this.saveButton.textContent = isEditing ? 'Guardar cambios' : 'Registrar incidente';
    this.cancelEditButton.hidden = !isEditing;
  }

  setSubmitting(isSubmitting, isEditing) {
    this.saveButton.disabled = isSubmitting;
    if (isSubmitting) {
      this.saveButton.textContent = isEditing ? 'Guardando cambios…' : 'Registrando…';
    } else {
      this.saveButton.textContent = isEditing ? 'Guardar cambios' : 'Registrar incidente';
    }
  }

  showFieldError(field, message) {
    const error = document.getElementById(`error-${field.name}`);
    field.setAttribute('aria-invalid', String(Boolean(message)));
    if (error) error.textContent = message;
  }

  showErrorSummary(errors) {
    if (errors.length === 0) {
      this.errorSummary.hidden = true;
      this.errorSummary.replaceChildren();
      return;
    }

    const message = errors.length === 1
      ? 'Revise el campo señalado antes de continuar.'
      : `Revise los ${errors.length} campos señalados antes de continuar.`;
    this.errorSummary.replaceChildren(createElement('p', '', message));
    this.errorSummary.hidden = false;
    this.errorSummary.focus();
  }

  showFormError(message) {
    this.errorSummary.replaceChildren(createElement('p', '', message));
    this.errorSummary.hidden = false;
    this.errorSummary.focus();
  }

  focusField(field) {
    field.focus();
  }

  showLoadError(message) {
    this.loading.hidden = false;
    this.loading.textContent = message;
    this.loading.classList.add('error-summary');
  }

  announce(message) {
    this.liveRegion.textContent = '';
    window.requestAnimationFrame(() => {
      this.liveRegion.textContent = message;
    });
  }

  showOperationMessage(message, type = 'success') {
    this.operationMessage.textContent = message;
    this.operationMessage.classList.toggle('error', type === 'error');
    this.operationMessage.hidden = false;
  }

  resetForm() {
    this.form.reset();
    this.descriptionCounter.textContent = '0/600';
    this.fields.forEach((field) => this.showFieldError(field, ''));
    this.showErrorSummary([]);
  }
}
