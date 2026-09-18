const formIncidente = document.getElementById('form-incidente');
const listaIncidentes = document.getElementById('lista-incidentes');
const detalleContenido = document.getElementById('detalle-contenido');
const estadoServidor = document.getElementById('estado');
const botonRegistrar = formIncidente.querySelector('button[type="submit"]');

function getClasePrioridad(prioridad) {
  const mapa = { alta: 'high', media: 'medium', baja: 'low' };
  return mapa[String(prioridad).toLowerCase()] || 'medium';
}

function mostrarDetalle(incidente) {
  const resumen = document.createElement('p');
  const codigo = document.createElement('strong');
  codigo.textContent = incidente.codigo;
  resumen.append(codigo, ` — ${incidente.tipo}.`);

  const datos = document.createElement('p');
  const partes = [
    `Prioridad: ${incidente.prioridad}`,
    `Estado: ${incidente.estado || 'Registrado'}`
  ];
  if (incidente.fecha) partes.push(`Fecha: ${incidente.fecha}`);
  if (incidente.responsable) partes.push(`Responsable: ${incidente.responsable}`);
  datos.textContent = `${partes.join('. ')}.`;

  const descripcion = document.createElement('p');
  descripcion.className = 'incident-description';
  descripcion.textContent = incidente.descripcion || 'Sin descripción adicional.';

  detalleContenido.replaceChildren(resumen, datos, descripcion);
}

function renderIncidente(incidente) {
  const articulo = document.createElement('article');
  articulo.className = `incident ${getClasePrioridad(incidente.prioridad)}`;
  articulo.tabIndex = 0;
  articulo.setAttribute('role', 'button');
  articulo.setAttribute('aria-label', `Ver detalle de ${incidente.codigo}`);

  const titulo = document.createElement('h3');
  titulo.textContent = `${incidente.codigo}: ${incidente.tipo}`;

  const resumen = document.createElement('p');
  resumen.textContent = `Prioridad ${incidente.prioridad}. Estado: ${incidente.estado || 'Registrado'}.`;

  articulo.append(titulo, resumen);
  articulo.addEventListener('click', () => mostrarDetalle(incidente));
  articulo.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault();
      mostrarDetalle(incidente);
    }
  });

  return articulo;
}

async function leerRespuestaJson(respuesta) {
  const data = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(data.error || `Error HTTP ${respuesta.status}`);
  }
  return data;
}

async function cargarIncidentesDesdeAPI() {
  try {
    estadoServidor.textContent = 'Solicitando incidentes al servidor...';
    const respuesta = await fetch('/api/incidentes');
    const incidentes = await leerRespuestaJson(respuesta);

    listaIncidentes.replaceChildren(...incidentes.map(renderIncidente));
    estadoServidor.textContent = `${incidentes.length} incidente(s) cargados desde la API.`;
  } catch (error) {
    estadoServidor.textContent = `No se pudieron cargar los incidentes: ${error.message}`;
    console.error(error);
  }
}

async function probarSalud() {
  try {
    const respuesta = await fetch('/api/salud');
    const data = await leerRespuestaJson(respuesta);
    estadoServidor.textContent = `Servicio: ${data.servicio}. Estado: ${data.estado}.`;
  } catch (error) {
    estadoServidor.textContent = `La ruta de salud no responde correctamente: ${error.message}`;
    console.error(error);
  }
}

formIncidente.addEventListener('submit', async function (evento) {
  evento.preventDefault();

  const datos = {
    tipo: document.getElementById('tipo').selectedOptions[0].textContent,
    fecha: document.getElementById('fecha').value,
    prioridad: document.getElementById('prioridad').value,
    responsable: document.getElementById('responsable').value,
    descripcion: document.getElementById('descripcion').value
  };

  botonRegistrar.disabled = true;
  botonRegistrar.textContent = 'Registrando...';
  estadoServidor.textContent = 'Enviando el incidente al servidor...';

  try {
    const respuesta = await fetch('/api/incidentes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    const incidente = await leerRespuestaJson(respuesta);

    listaIncidentes.prepend(renderIncidente(incidente));
    mostrarDetalle(incidente);
    estadoServidor.textContent = `${incidente.codigo} registrado y guardado correctamente.`;
    this.reset();
  } catch (error) {
    estadoServidor.textContent = `No se pudo registrar el incidente: ${error.message}`;
  } finally {
    botonRegistrar.disabled = false;
    botonRegistrar.textContent = 'Registrar incidente';
  }
});

document.getElementById('salud').addEventListener('click', probarSalud);
document.getElementById('cargar').addEventListener('click', cargarIncidentesDesdeAPI);
