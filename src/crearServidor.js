const fs = require('fs');
const path = require('path');
const express = require('express');
const IncidenteRepository = require('./infraestructura/IncidenteRepository');
const IncidenteService = require('./aplicacion/IncidenteService');
const crearRutasApi = require('./presentacion/routes/apiRoutes');
const registroPeticiones = require('./presentacion/middleware/registroPeticiones');
const { rutaNoEncontrada, manejoErrores } = require('./presentacion/middleware/manejoErrores');

const INCIDENTES_PREDETERMINADOS = [
  {
    id: 1,
    codigo: 'INC-001',
    tipo: 'acceso-no-autorizado',
    tipoTexto: 'Acceso no autorizado',
    fecha: '2026-09-17',
    prioridad: 'alta',
    estado: 'En revisión',
    responsable: 'Equipo SOC',
    descripcion: 'Se detectó un intento de acceso desde una IP no autorizada a un sistema administrativo.',
    evidencia: 'Sin evidencia adjunta'
  },
  {
    id: 2,
    codigo: 'INC-002',
    tipo: 'phishing',
    tipoTexto: 'Phishing',
    fecha: '2026-09-18',
    prioridad: 'media',
    estado: 'Registrado',
    responsable: 'Mesa de ayuda',
    descripcion: 'Los usuarios recibieron correos con enlaces sospechosos dirigidos a credenciales institucionales.',
    evidencia: 'Sin evidencia adjunta'
  },
  {
    id: 3,
    codigo: 'INC-003',
    tipo: 'fallo-disponibilidad',
    tipoTexto: 'Fallo de disponibilidad',
    fecha: '2026-09-19',
    prioridad: 'baja',
    estado: 'Cerrado',
    responsable: 'Infraestructura',
    descripcion: 'Se reportó una interrupción leve de un servicio interno y fue solucionada por infraestructura.',
    evidencia: 'Sin evidencia adjunta'
  }
];

function cargarIncidentesIniciales(rootDir) {
  try {
    const contenido = fs.readFileSync(path.join(rootDir, 'data', 'incidentes.json'), 'utf8');
    const incidentes = JSON.parse(contenido);
    return Array.isArray(incidentes) ? incidentes : INCIDENTES_PREDETERMINADOS;
  } catch {
    return INCIDENTES_PREDETERMINADOS;
  }
}

function crearServidor(opciones = {}) {
  const rootDir = opciones.rootDir || path.resolve(__dirname, '..');
  const repository = opciones.repository || new IncidenteRepository(
    opciones.incidentesIniciales || cargarIncidentesIniciales(rootDir)
  );
  const service = new IncidenteService(repository);
  const app = express();

  app.disable('x-powered-by');
  app.use(registroPeticiones);
  app.use(express.json({ limit: '20kb' }));
  app.use('/api', crearRutasApi(service));
  app.use('/api', rutaNoEncontrada);

  app.use('/css', express.static(path.join(rootDir, 'css')));
  app.use('/js', express.static(path.join(rootDir, 'js')));
  app.use('/assets', express.static(path.join(rootDir, 'assets')));
  app.get(['/', '/index.html'], (req, res, next) => {
    res.sendFile(path.join(rootDir, 'index.html'), (error) => {
      if (error) next(error);
    });
  });

  app.use(rutaNoEncontrada);
  app.use(manejoErrores);

  return app;
}

module.exports = { crearServidor };
