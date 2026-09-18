# Gestión de incidentes de ciberseguridad

## Ejecución

1. Instale las dependencias del proyecto:

   ```bash
   npm install
   ```

2. Inicie el servidor:

   ```bash
   npm start
   ```

3. Abra <http://localhost:3000> en el navegador.

No es necesario usar Live Server. El servidor Node.js entrega la interfaz y expone la API desde el mismo origen.

Los incidentes registrados desde el formulario se guardan en `data/incidentes.json` y permanecen disponibles después de reiniciar el servidor.

## API

- `GET /api/salud`: comprueba el estado del servicio.
- `GET /api/incidentes`: devuelve todos los incidentes.
- `POST /api/incidentes`: valida y guarda un nuevo incidente.

Para ejecutar las pruebas automatizadas sin modificar el archivo real:

```bash
npm test
```
