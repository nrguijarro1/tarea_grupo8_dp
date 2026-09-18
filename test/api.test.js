const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { crearServidor } = require('../src/crearServidor');
const IncidenteRepository = require('../src/infraestructura/IncidenteRepository');

const rootDir = path.resolve(__dirname, '..');
const fechaPasada = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
let tempDir;
let dataFile;
let server;
let baseUrl;

async function iniciarServidor(repository) {
  const nuevoServidor = crearServidor({ rootDir, repository });
  await new Promise((resolve) => nuevoServidor.listen(0, '127.0.0.1', resolve));
  const { port } = nuevoServidor.address();
  return {
    server: nuevoServidor,
    baseUrl: `http://127.0.0.1:${port}`
  };
}

async function iniciarServidorPredeterminado(rootDirTemporal) {
  const nuevoServidor = crearServidor({ rootDir: rootDirTemporal });
  await new Promise((resolve) => nuevoServidor.listen(0, '127.0.0.1', resolve));
  const { port } = nuevoServidor.address();
  return {
    server: nuevoServidor,
    baseUrl: `http://127.0.0.1:${port}`
  };
}

async function cerrarServidor(servidor) {
  await new Promise((resolve, reject) => {
    servidor.close((error) => (error ? reject(error) : resolve()));
  });
}

test.before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'incidentes-api-'));
  dataFile = path.join(tempDir, 'incidentes.json');
  await fs.writeFile(dataFile, JSON.stringify([{
    id: 1,
    codigo: 'INC-001',
    tipo: 'phishing',
    tipoTexto: 'Phishing',
    fecha: fechaPasada,
    prioridad: 'media',
    estado: 'Registrado',
    responsable: 'Equipo SOC',
    descripcion: 'Descripción inicial suficientemente extensa para ejecutar la prueba.',
    evidencia: 'Sin evidencia adjunta'
  }], null, 2), 'utf8');

  const iniciado = await iniciarServidor(new IncidenteRepository(dataFile));
  server = iniciado.server;
  baseUrl = iniciado.baseUrl;
});

test.after(async () => {
  if (server?.listening) await cerrarServidor(server);
  await fs.rm(tempDir, { recursive: true, force: true });
});

test('GET /api/salud responde 200 y JSON', async () => {
  const respuesta = await fetch(`${baseUrl}/api/salud`);
  const data = await respuesta.json();

  assert.equal(respuesta.status, 200);
  assert.match(respuesta.headers.get('content-type'), /^application\/json; charset=utf-8$/);
  assert.equal(data.estado, 'ok');
});

test('GET /api/incidentes devuelve el contenido persistido', async () => {
  const respuesta = await fetch(`${baseUrl}/api/incidentes`);
  const data = await respuesta.json();

  assert.equal(respuesta.status, 200);
  assert.equal(data.length, 1);
  assert.equal(data[0].codigo, 'INC-001');
});

test('POST /api/incidentes responde 201 y escribe físicamente el JSON', async () => {
  const respuesta = await fetch(`${baseUrl}/api/incidentes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tipo: 'acceso-no-autorizado',
      fecha: fechaPasada,
      prioridad: 'alta',
      responsable: 'Equipo SOC',
      descripcion: 'Se detectó un acceso no autorizado en el sistema institucional.',
      evidencia: 'captura.png'
    })
  });
  const data = await respuesta.json();
  const contenidoGuardado = JSON.parse(await fs.readFile(dataFile, 'utf8'));

  assert.equal(respuesta.status, 201);
  assert.equal(data.id, 2);
  assert.equal(data.codigo, 'INC-002');
  assert.equal(data.tipoTexto, 'Acceso no autorizado');
  assert.equal(contenidoGuardado[0].codigo, 'INC-002');
  assert.equal(contenidoGuardado.length, 2);
});

test('POST /api/incidentes incompleto responde 400 y no escribe', async () => {
  const cantidadAnterior = JSON.parse(await fs.readFile(dataFile, 'utf8')).length;
  const respuesta = await fetch(`${baseUrl}/api/incidentes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo: 'phishing' })
  });
  const data = await respuesta.json();
  const cantidadPosterior = JSON.parse(await fs.readFile(dataFile, 'utf8')).length;

  assert.equal(respuesta.status, 400);
  assert.equal(data.error, 'Datos incompletos');
  assert.equal(cantidadPosterior, cantidadAnterior);
});

test('los POST simultáneos reciben códigos distintos sin perder registros', async () => {
  const crear = (descripcion) => fetch(`${baseUrl}/api/incidentes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tipo: 'malware',
      fecha: fechaPasada,
      prioridad: 'baja',
      descripcion
    })
  }).then((respuesta) => respuesta.json());

  const [primero, segundo] = await Promise.all([
    crear('Primer incidente simultáneo con una descripción válida y completa.'),
    crear('Segundo incidente simultáneo con una descripción válida y completa.')
  ]);
  const codigos = new Set([primero.codigo, segundo.codigo]);
  const contenidoGuardado = JSON.parse(await fs.readFile(dataFile, 'utf8'));

  assert.equal(codigos.size, 2);
  assert.equal(contenidoGuardado.length, 4);
});

test('el servidor entrega la interfaz y sus módulos JavaScript', async () => {
  const [inicio, modulo] = await Promise.all([
    fetch(`${baseUrl}/`),
    fetch(`${baseUrl}/js/app.js`)
  ]);

  assert.equal(inicio.status, 200);
  assert.match(inicio.headers.get('content-type'), /^text\/html; charset=utf-8$/);
  assert.equal(modulo.status, 200);
  assert.match(modulo.headers.get('content-type'), /^application\/javascript; charset=utf-8$/);
});

test('una ruta inexistente responde 404', async () => {
  const respuesta = await fetch(`${baseUrl}/no-existe`);

  assert.equal(respuesta.status, 404);
  assert.match(respuesta.headers.get('content-type'), /^application\/json; charset=utf-8$/);
});

test('los incidentes permanecen después de reiniciar el servidor', async () => {
  await cerrarServidor(server);
  const rootPredeterminado = path.join(tempDir, 'proyecto-predeterminado');
  const dataPredeterminado = path.join(rootPredeterminado, 'data');
  const archivoPredeterminado = path.join(dataPredeterminado, 'incidentes.json');
  await fs.mkdir(dataPredeterminado, { recursive: true });
  await fs.copyFile(dataFile, archivoPredeterminado);

  let iniciado = await iniciarServidorPredeterminado(rootPredeterminado);
  const creacion = await fetch(`${iniciado.baseUrl}/api/incidentes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tipo: 'phishing',
      fecha: fechaPasada,
      prioridad: 'alta',
      descripcion: 'Incidente usado para comprobar persistencia después del reinicio.'
    })
  });
  const incidenteCreado = await creacion.json();
  await cerrarServidor(iniciado.server);

  iniciado = await iniciarServidorPredeterminado(rootPredeterminado);
  server = iniciado.server;
  baseUrl = iniciado.baseUrl;
  const respuesta = await fetch(`${baseUrl}/api/incidentes`);
  const incidentes = await respuesta.json();
  const guardadosEnDisco = JSON.parse(await fs.readFile(archivoPredeterminado, 'utf8'));

  assert.equal(creacion.status, 201);
  assert.equal(respuesta.status, 200);
  assert.ok(incidentes.some((incidente) => incidente.codigo === incidenteCreado.codigo));
  assert.ok(guardadosEnDisco.some((incidente) => incidente.codigo === incidenteCreado.codigo));
  assert.equal(incidentes.length, 5);
});
