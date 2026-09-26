function registroPeticiones(req, res, next) {
  const inicio = process.hrtime.bigint();

  res.on('finish', () => {
    const duracionMs = Number(process.hrtime.bigint() - inicio) / 1_000_000;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duracionMs.toFixed(1)}ms`
    );
  });

  next();
}

module.exports = registroPeticiones;
