const { crearServidor } = require('./src/crearServidor');

const PORT = Number(process.env.PORT) || 3000;
const server = crearServidor();

server.listen(PORT, () => {
  console.log(`Servidor disponible en http://localhost:${PORT}`);
});
