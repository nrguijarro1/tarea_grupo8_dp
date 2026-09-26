const { ErrorHttp } = require('../../dominio/Errores');

function rutaNoEncontrada(req, res, next) {
  const error = new ErrorHttp('Ruta no encontrada', 404);
  error.ruta = req.originalUrl;
  next(error);
}

function manejoErrores(error, req, res, next) {
  if (res.headersSent) return next(error);

  let status = Number(error.status || error.statusCode) || 500;
  let mensaje = error.message || 'Error interno del servidor';

  if (error.type === 'entity.parse.failed') {
    status = 400;
    mensaje = 'El cuerpo de la petición no contiene JSON válido.';
  } else if (error.type === 'entity.too.large') {
    status = 413;
    mensaje = 'La petición supera el tamaño permitido.';
  } else if (status >= 500) {
    console.error(error);
    status = 500;
    mensaje = 'Error interno del servidor';
  }

  const respuesta = { error: mensaje, status };
  if (error.ruta) respuesta.ruta = error.ruta;
  return res.status(status).json(respuesta);
}

module.exports = { rutaNoEncontrada, manejoErrores };
