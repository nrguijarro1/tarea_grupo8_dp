# Gestión de incidentes de ciberseguridad

Aplicación web académica para registrar, consultar, filtrar, editar y eliminar incidentes de ciberseguridad. El servidor Express entrega la interfaz y una API REST desde el mismo origen.

## Tecnologías

- Node.js 18 o posterior
- Express 5
- HTML5, CSS3 y JavaScript modular
- Fetch API
- Módulo de pruebas nativo `node:test`

## Estructura

```text
Tarea/
├── css/                         Estilos de la interfaz
├── data/incidentes.json         Datos iniciales opcionales
├── js/                          Modelo, vista y controlador del navegador
├── src/
│   ├── aplicacion/              Casos de uso del CRUD
│   ├── dominio/                 Entidad, reglas y errores del dominio
│   ├── infraestructura/         Repositorio en memoria
│   └── presentacion/            Controladores, rutas y middleware Express
├── test/api.test.js             Pruebas automatizadas de la API
├── index.html                   Interfaz principal
└── server.js                    Punto de entrada
```

Al iniciar, el repositorio carga una copia de `data/incidentes.json` como semilla. Si el archivo no está disponible, utiliza datos de ejemplo incluidos en el servidor. Todas las operaciones CRUD posteriores se realizan en memoria y se reinician al detener el proceso.

## Instalación y ejecución

Desde la carpeta `Tarea`:

```bash
npm install
npm start
```

Abra <http://localhost:3000>. No se necesita Live Server.

El puerto predeterminado es `3000`; puede cambiarse mediante la variable de entorno `PORT`.

## API REST

Todas las respuestas de la API son JSON, salvo la eliminación correcta, que responde sin cuerpo.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/salud` | Consultar el estado de la API |
| GET | `/api/incidentes` | Listar todos los incidentes |
| GET | `/api/incidentes/:id` | Obtener un incidente por ID |
| POST | `/api/incidentes` | Crear un incidente |
| PUT | `/api/incidentes/:id` | Reemplazar los datos editables |
| PATCH | `/api/incidentes/:id` | Actualizar parcialmente un incidente |
| DELETE | `/api/incidentes/:id` | Eliminar un incidente |

Los errores usan el formato `{ "error": "Mensaje explicativo", "status": 400 }`. La API valida tipo, fecha, prioridad, estado, responsable, descripción y evidencia antes de modificar el repositorio.

## Pruebas

```bash
npm test
```

Las pruebas levantan servidores en puertos temporales y usan repositorios aislados en memoria, por lo que no alteran `data/incidentes.json`.
