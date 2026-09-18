const priorityClasses = {
  alta: 'high',
  media: 'medium',
  baja: 'low'
};

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

const formatDate = (date) => new Intl.DateTimeFormat('es-EC', {
  dateStyle: 'long',
  timeZone: 'UTC'
}).format(new Date(`${date}T00:00:00Z`));

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
    this.fields = [...this.form.elements].filter((element) => element.name);
  }

  setMaximumDate(date) {
    this.form.elements.fecha.max = date;
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

  bindDescriptionCounter() {
    this.form.elements.descripcion.addEventListener('input', (event) => {
      this.descriptionCounter.textContent = `${event.target.value.length}/600`;
    });
  }

  getFormData() {
    const values = new FormData(this.form);
    const typeSelect = this.form.elements.tipo;
    const file = this.form.elements.evidencia.files[0];

    return {
      tipo: values.get('tipo'),
      tipoTexto: typeSelect.options[typeSelect.selectedIndex].text,
      fecha: values.get('fecha'),
      prioridad: values.get('prioridad'),
      responsable: values.get('responsable').trim() || 'No especificado',
      descripcion: values.get('descripcion').trim(),
      evidencia: file?.name || 'Sin evidencia adjunta'
    };
  }

  renderIncidents(incidents) {
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

    this.total.textContent = incidents.length;
    this.total.setAttribute('aria-label', `${incidents.length} incidentes`);
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

  createEvidenceLink(fileName) {
    const paragraph = createElement('p', '', 'Evidencia: ');
    const link = document.createElement('a');
    const safeName = String(fileName).trim();

    if (!safeName || safeName === 'Sin evidencia adjunta') {
      paragraph.textContent = 'Evidencia: Sin evidencia adjunta';
      return paragraph;
    }

    link.href = `/assets/${encodeURIComponent(safeName)}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = safeName;
    paragraph.append(link);
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
    const evidence = this.createEvidenceLink(incident.evidencia);
    this.detail.append(title, dataList, description, evidence);
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

  resetForm() {
    this.form.reset();
    this.descriptionCounter.textContent = '0/600';
    this.fields.forEach((field) => this.showFieldError(field, ''));
    this.showErrorSummary([]);
  }
}
