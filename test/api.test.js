const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { crearServidor } = require('../src/crearServidor');
const IncidenteRepository = require('../src/infraestructura/IncidenteRepository');

const rootDir = path.resolve(__dirname, '..');
const fechaPasada = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const incidenteInicial = {
  id: 1,
  codigo: 'INC-001',
  tipo: 'phishing',
  tipoTexto: 'Phishing',
  fecha: fechaPasada,
  prioridad: 'media',
  estado: 'Registrado',
  responsable: 'Equipo SOC',
  descripcion: 'Descripción inicial suficientemente extensa para ejecutar las pruebas.',
  evidencia: 'Sin evidencia adjunta'
};

const datosValidos = {
  tipo: 'acceso-no-autorizado',
  fecha: fechaPasada,
  prioridad: 'alta',
  estado: 'En revisión',
  responsable: 'Equipo SOC',
  descripcion: 'Se detectó un acceso no autorizado en el sistema institucional.',
  evidencia: 'captura.png'
};

let server;
let baseUrl;

async function iniciarServidor(incidentes = [incidenteInicial]) {
  const repository = new IncidenteRepository(incidentes);
  const app = crearServidor({ rootDir, repository });
  const servidor = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => servidor.once('listening', resolve));
  const { port } = servidor.address();
  return { server: servidor, baseUrl: `http://127.0.0.1:${port}` };
}

async function cerrarServidor(servidor) {
  if (!servidor?.listening) return;
  servidor.closeAllConnections?.();
  await new Promise((resolve, reject) => {
    servidor.close((error) => (error ? reject(error) : resolve()));
  });
}

async function enviarJson(ruta, method, body) {
  return fetch(`${baseUrl}${ruta}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

test.beforeEach(async () => {
  const iniciado = await iniciarServidor();
  server = iniciado.server;
  baseUrl = iniciado.baseUrl;
});

test.afterEach(async () => {
  await cerrarServidor(server);
});

test('GET /api/salud responde 200 y JSON', async () => {
  const respuesta = await fetch(`${baseUrl}/api/salud`);
  const data = await respuesta.json();

  assert.equal(respuesta.status, 200);
  assert.match(respuesta.headers.get('content-type'), /^application\/json; charset=utf-8$/);
  assert.equal(data.estado, 'ok');
});

test('GET /api/incidentes devuelve todos los incidentes en memoria', async () => {
  const respuesta = await fetch(`${baseUrl}/api/incidentes`);
  const data = await respuesta.json();

  assert.equal(respuesta.status, 200);
  assert.equal(data.length, 1);
  assert.equal(data[0].codigo, 'INC-001');
});

test('GET /api/incidentes/:id devuelve un incidente individual', async () => {
  const respuesta = await fetch(`${baseUrl}/api/incidentes/1`);
  const data = await respuesta.json();

  assert.equal(respuesta.status, 200);
  assert.equal(data.id, 1);
  assert.equal(data.tipoTexto, 'Phishing');
});

test('GET de un incidente inexistente responde 404', async () => {
  const respuesta = await fetch(`${baseUrl}/api/incidentes/999`);
  const data = await respuesta.json();

  assert.equal(respuesta.status, 404);
  assert.deepEqual(data, { error: 'Incidente no encontrado', status: 404 });
});

test('un identificador inválido responde 400', async () => {
  const respuesta = await fetch(`${baseUrl}/api/incidentes/no-valido`);
  const data = await respuesta.json();

  assert.equal(respuesta.status, 400);
  assert.match(data.error, /identificador/);
});

test('POST /api/incidentes crea un incidente y responde 201', async () => {
  const respuesta = await enviarJson('/api/incidentes', 'POST', datosValidos);
  const data = await respuesta.json();
  const listado = await (await fetch(`${baseUrl}/api/incidentes`)).json();

  assert.equal(respuesta.status, 201);
  assert.equal(respuesta.headers.get('location'), '/api/incidentes/2');
  assert.equal(data.id, 2);
  assert.equal(data.codigo, 'INC-002');
  assert.equal(data.tipoTexto, 'Acceso no autorizado');
  assert.equal(listado.length, 2);
});

test('POST con datos incompletos responde 400 y no crea el incidente', async () => {
  const respuesta = await enviarJson('/api/incidentes', 'POST', { tipo: 'phishing' });
  const data = await respuesta.json();
  const listado = await (await fetch(`${baseUrl}/api/incidentes`)).json();

  assert.equal(respuesta.status, 400);
  assert.equal(data.error, 'Datos incompletos');
  assert.equal(listado.length, 1);
});

test('POST rechaza tipo, prioridad, estado, fecha, descripción y responsable inválidos', async () => {
  const casos = [
    [{ ...datosValidos, tipo: 'desconocido' }, /tipo/],
    [{ ...datosValidos, prioridad: 'urgente' }, /prioridad/],
    [{ ...datosValidos, estado: 'Pendiente' }, /estado/],
    [{ ...datosValidos, fecha: '2999-01-01' }, /futuro/],
    [{ ...datosValidos, descripcion: 'Muy corta' }, /entre 30 y 600/],
    [{ ...datosValidos, responsable: 'A' }, /responsable/]
  ];

  for (const [body, patron] of casos) {
    const respuesta = await enviarJson('/api/incidentes', 'POST', body);
    const data = await respuesta.json();
    assert.equal(respuesta.status, 400);
    assert.match(data.error, patron);
  }
});

test('PUT /api/incidentes/:id reemplaza los campos editables', async () => {
  const actualizacion = {
    ...datosValidos,
    tipo: 'malware',
    prioridad: 'baja',
    estado: 'Resuelto',
    descripcion: 'El equipo eliminó el software malicioso y verificó todos los sistemas.'
  };
  const respuesta = await enviarJson('/api/incidentes/1', 'PUT', actualizacion);
  const data = await respuesta.json();

  assert.equal(respuesta.status, 200);
  assert.equal(data.id, 1);
  assert.equal(data.codigo, 'INC-001');
  assert.equal(data.tipoTexto, 'Malware');
  assert.equal(data.estado, 'Resuelto');
});

test('PUT incompleto responde 400', async () => {
  const respuesta = await enviarJson('/api/incidentes/1', 'PUT', { prioridad: 'alta' });
  const data = await respuesta.json();

  assert.equal(respuesta.status, 400);
  assert.equal(data.error, 'Datos incompletos');
});

test('PATCH /api/incidentes/:id actualiza solo los campos enviados', async () => {
  const respuesta = await enviarJson('/api/incidentes/1', 'PATCH', {
    estado: 'Cerrado',
    prioridad: 'baja'
  });
  const data = await respuesta.json();

  assert.equal(respuesta.status, 200);
  assert.equal(data.estado, 'Cerrado');
  assert.equal(data.prioridad, 'baja');
  assert.equal(data.descripcion, incidenteInicial.descripcion);
});

test('PATCH vacío responde 400', async () => {
  const respuesta = await enviarJson('/api/incidentes/1', 'PATCH', {});
  const data = await respuesta.json();

  assert.equal(respuesta.status, 400);
  assert.match(data.error, /campo editable/);
});

test('DELETE /api/incidentes/:id responde 204 y elimina el incidente', async () => {
  const respuesta = await fetch(`${baseUrl}/api/incidentes/1`, { method: 'DELETE' });
  const consulta = await fetch(`${baseUrl}/api/incidentes/1`);
  await consulta.json();

  assert.equal(respuesta.status, 204);
  assert.equal(await respuesta.text(), '');
  assert.equal(consulta.status, 404);
});

test('DELETE de un incidente inexistente responde 404', async () => {
  const respuesta = await fetch(`${baseUrl}/api/incidentes/999`, { method: 'DELETE' });
  await respuesta.json();

  assert.equal(respuesta.status, 404);
});

test('un cuerpo con JSON inválido responde 400 sin mostrar detalles internos', async () => {
  const respuesta = await fetch(`${baseUrl}/api/incidentes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{json inválido'
  });
  const data = await respuesta.json();

  assert.equal(respuesta.status, 400);
  assert.equal(data.error, 'El cuerpo de la petición no contiene JSON válido.');
  assert.equal(data.stack, undefined);
});

test('un error interno responde 500 sin filtrar detalles técnicos', async () => {
  await cerrarServidor(server);
  const repository = {
    listar() {
      throw new Error('Detalle interno reservado');
    }
  };
  const app = crearServidor({ rootDir, repository });
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const respuesta = await fetch(`${baseUrl}/api/incidentes`);
  const data = await respuesta.json();

  assert.equal(respuesta.status, 500);
  assert.deepEqual(data, { error: 'Error interno del servidor', status: 500 });
  assert.doesNotMatch(JSON.stringify(data), /Detalle interno reservado/);
});

test('una ruta API inexistente responde 404 en formato JSON', async () => {
  const respuesta = await fetch(`${baseUrl}/api/no-existe`);
  const data = await respuesta.json();

  assert.equal(respuesta.status, 404);
  assert.equal(data.error, 'Ruta no encontrada');
  assert.equal(data.ruta, '/api/no-existe');
});

test('Express entrega la interfaz y sus módulos JavaScript', async () => {
  const [inicio, modulo] = await Promise.all([
    fetch(`${baseUrl}/`),
    fetch(`${baseUrl}/js/app.js`)
  ]);
  await Promise.all([inicio.text(), modulo.text()]);

  assert.equal(inicio.status, 200);
  assert.match(inicio.headers.get('content-type'), /^text\/html; charset=utf-8$/);
  assert.equal(modulo.status, 200);
  assert.match(modulo.headers.get('content-type'), /^text\/javascript; charset=utf-8$/);
});

test('los cambios viven en memoria y no sobreviven a una nueva instancia', async () => {
  const creacion = await enviarJson('/api/incidentes', 'POST', datosValidos);
  await creacion.json();
  assert.equal(creacion.status, 201);
  await cerrarServidor(server);

  const reiniciado = await iniciarServidor();
  server = reiniciado.server;
  baseUrl = reiniciado.baseUrl;
  const data = await (await fetch(`${baseUrl}/api/incidentes`)).json();

  assert.equal(data.length, 1);
  assert.equal(data[0].codigo, 'INC-001');
});
