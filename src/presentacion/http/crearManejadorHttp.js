const path = require('path');
const { ErrorValidacion } = require('../../dominio/Incidente');
const { enviarJson, enviarArchivo, leerJson } = require('./respuestas');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf'
};

const DIRECTORIOS_PUBLICOS = ['/css/', '/js/', '/assets/'];

function metodoNoPermitido(res, permitidos) {
  enviarJson(
    res,
    405,
    { error: 'Método no permitido' },
    { Allow: permitidos.join(', ') }
  );
}

function obtenerArchivoPublico(rootDir, pathname) {
  if (pathname === '/' || pathname === '/index.html') {
    return path.join(rootDir, 'index.html');
  }

  if (!DIRECTORIOS_PUBLICOS.some((directorio) => pathname.startsWith(directorio))) {
    return null;
  }

  let rutaRelativa;
  try {
    rutaRelativa = decodeURIComponent(pathname).replace(/^\/+/, '');
  } catch {
    return null;
  }

  const archivo = path.resolve(rootDir, rutaRelativa);
  const primerSegmento = rutaRelativa.split(/[\\/]/, 1)[0];
  const directorioPermitido = `${path.resolve(rootDir, primerSegmento)}${path.sep}`;
  return archivo.startsWith(directorioPermitido) ? archivo : null;
}

function crearManejadorHttp({ rootDir, service }) {
  return async function manejarPeticion(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    console.log(`${req.method} ${url.pathname}`);

    try {
      if (url.pathname === '/api/salud') {
        if (req.method !== 'GET') return metodoNoPermitido(res, ['GET']);
        return enviarJson(res, 200, {
          estado: 'ok',
          servicio: 'Plataforma de incidentes'
        });
      }

      if (url.pathname === '/api/incidentes') {
        if (req.method === 'GET') {
          return enviarJson(res, 200, await service.listar());
        }
        if (req.method === 'POST') {
          const datos = await leerJson(req);
          const incidente = await service.registrar(datos);
          return enviarJson(res, 201, incidente);
        }
        return metodoNoPermitido(res, ['GET', 'POST']);
      }

      const archivo = obtenerArchivoPublico(rootDir, url.pathname);
      if (archivo) {
        if (req.method !== 'GET') return metodoNoPermitido(res, ['GET']);
        const extension = path.extname(archivo).toLowerCase();
        return enviarArchivo(
          res,
          archivo,
          MIME_TYPES[extension] || 'application/octet-stream'
        );
      }

      return enviarJson(res, 404, {
        error: 'Ruta no encontrada',
        ruta: url.pathname
      });
    } catch (error) {
      if (error instanceof ErrorValidacion) {
        return enviarJson(res, 400, { error: error.message });
      }

      const statusCode = error.statusCode || 500;
      if (statusCode === 500) console.error(error);
      return enviarJson(res, statusCode, {
        error: statusCode === 500 ? 'Error interno del servidor' : error.message
      });
    }
  };
}

module.exports = crearManejadorHttp;
