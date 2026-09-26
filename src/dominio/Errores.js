class ErrorHttp extends Error {
  constructor(mensaje, status = 500) {
    super(mensaje);
    this.name = 'ErrorHttp';
    this.status = status;
  }
}

class ErrorValidacion extends ErrorHttp {
  constructor(mensaje) {
    super(mensaje, 400);
    this.name = 'ErrorValidacion';
  }
}

class ErrorNoEncontrado extends ErrorHttp {
  constructor(mensaje = 'Incidente no encontrado') {
    super(mensaje, 404);
    this.name = 'ErrorNoEncontrado';
  }
}

module.exports = { ErrorHttp, ErrorValidacion, ErrorNoEncontrado };
