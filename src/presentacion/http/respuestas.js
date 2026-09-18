const fs = require('fs/promises');

function enviarJson(res, statusCode, data, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...headers
  });
  res.end(JSON.stringify(data));
}

async function enviarArchivo(res, filePath, contentType) {
  try {
    const contenido = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(contenido);
  } catch {
    enviarJson(res, 404, { error: 'Archivo no encontrado' });
  }
}

function leerJson(req, limite = 20_000) {
  return new Promise((resolve, reject) => {
    let contenido = '';

    req.setEncoding('utf8');
    req.on('data', (fragmento) => {
      contenido += fragmento;
      if (contenido.length > limite) {
        const error = new Error('La petición supera el tamaño permitido.');
        error.statusCode = 413;
        reject(error);
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!contenido) {
        const error = new Error('El cuerpo JSON es obligatorio.');
        error.statusCode = 400;
        reject(error);
        return;
      }

      try {
        resolve(JSON.parse(contenido));
      } catch {
        const error = new Error('El cuerpo de la petición no contiene JSON válido.');
        error.statusCode = 400;
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

module.exports = { enviarJson, enviarArchivo, leerJson };
