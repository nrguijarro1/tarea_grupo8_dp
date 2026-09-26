const express = require('express');
const IncidenteController = require('../controladores/IncidenteController');

function crearRutasApi(service) {
  const router = express.Router();
  const controller = new IncidenteController(service);

  router.get('/salud', (req, res) => {
    res.status(200).json({
      estado: 'ok',
      servicio: 'Plataforma de incidentes'
    });
  });

  router.route('/incidentes')
    .get(controller.listar)
    .post(controller.crear);

  router.route('/incidentes/:id')
    .get(controller.obtener)
    .put(controller.reemplazar)
    .patch(controller.actualizar)
    .delete(controller.eliminar);

  return router;
}

module.exports = crearRutasApi;
