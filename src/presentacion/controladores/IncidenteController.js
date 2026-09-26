class IncidenteController {
  constructor(service) {
    this.service = service;
  }

  listar = (req, res) => {
    res.status(200).json(this.service.listar());
  };

  obtener = (req, res) => {
    res.status(200).json(this.service.buscarPorId(req.params.id));
  };

  crear = (req, res) => {
    const incidente = this.service.registrar(req.body);
    res
      .location(`/api/incidentes/${incidente.id}`)
      .status(201)
      .json(incidente);
  };

  reemplazar = (req, res) => {
    res.status(200).json(this.service.reemplazar(req.params.id, req.body));
  };

  actualizar = (req, res) => {
    res.status(200).json(this.service.actualizarParcialmente(req.params.id, req.body));
  };

  eliminar = (req, res) => {
    this.service.eliminar(req.params.id);
    res.status(204).send();
  };
}

module.exports = IncidenteController;
