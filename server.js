const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;

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

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sendFile(res, filePath, contentType) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(res, 404, { error: 'Archivo no encontrado', ruta: filePath });
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

function readIncidents() {
  const filePath = path.join(ROOT, 'assets', 'incidentes.json');
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  console.log(`${req.method} ${pathname}`);

  if (pathname === '/api/salud') {
    sendJson(res, 200, {
      estado: 'ok',
      servicio: 'Plataforma de incidentes'
    });
    return;
  }

  if (pathname === '/api/incidentes') {
    try {
      const incidentes = readIncidents();
      sendJson(res, 200, incidentes);
      return;
    } catch (error) {
      sendJson(res, 500, { error: 'No se pudieron cargar los incidentes.' });
      return;
    }
  }

  if (pathname === '/' || pathname === '/index.html') {
    sendFile(res, path.join(ROOT, 'index.html'), 'text/html; charset=utf-8');
    return;
  }

  const normalizedPath = pathname === '/assets' ? '/assets/incidentes.json' : pathname;
  const filePath = path.join(ROOT, normalizedPath.replace(/^\//, ''));
  const extension = path.extname(filePath).toLowerCase();

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    sendFile(res, filePath, MIME_TYPES[extension] || 'application/octet-stream');
    return;
  }

  sendJson(res, 404, {
    error: 'Ruta no encontrada',
    ruta: pathname
  });
});

server.listen(PORT, () => {
  console.log(`Servidor disponible en http://localhost:${PORT}`);
});
