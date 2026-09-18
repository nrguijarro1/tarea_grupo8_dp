const http = require('http');
const path = require('path');
const IncidenteRepository = require('./infraestructura/IncidenteRepository');
const IncidenteService = require('./aplicacion/IncidenteService');
const crearManejadorHttp = require('./presentacion/http/crearManejadorHttp');

function crearServidor(opciones = {}) {
  const rootDir = opciones.rootDir || path.resolve(__dirname, '..');
  const repository = opciones.repository || new IncidenteRepository(
    path.join(rootDir, 'data', 'incidentes.json')
  );
  const service = new IncidenteService(repository);
  const manejarPeticion = crearManejadorHttp({ rootDir, service });

  return http.createServer(manejarPeticion);
}

module.exports = { crearServidor };
