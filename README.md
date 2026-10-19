# Gestión de incidentes de ciberseguridad

Aplicación académica con HTML, CSS y JavaScript modular, API FastAPI, PostgreSQL
mediante SQLAlchemy y archivos en Supabase Storage. FastAPI entrega la interfaz
y la API desde el mismo origen.

El frontend separa vista (`js/view.js`), controlador (`js/controller.js`),
modelo HTTP y estado (`js/model.js`) y reglas puras (`js/rules.js`). El backend
separa rutas, servicios, repositorios y modelos SQLAlchemy.

## Requisitos

- Python 3.14 y Node.js 22 para la configuración comprobada en la Semana 7.
- PostgreSQL para ejecutar la plataforma; Supabase Storage para evidencias.
- Node.js se usa solo en `quality/` para Jest y ESLint, nunca como servidor.

## Preparación en Windows

Desde la raíz del proyecto, con Python compatible con las dependencias:

```powershell
py -3.14 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
npm install --prefix quality
```

Si todavía no existe `backend/.env`, copiar `backend/.env.example` a ese nombre.
Completar las variables de PostgreSQL y generar una clave JWT aleatoria:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

Guardar el valor únicamente como `JWT_SECRET_KEY` en el archivo local. Se requieren
al menos 32 bytes y la aplicación comprueba esta configuración al iniciar.
`.gitignore` excluye archivos de secretos, entornos virtuales y cachés.

En una base administrada por las migraciones del proyecto:

```powershell
.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
.\.venv\Scripts\python.exe backend/crear_admin.py
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

El script de cuentas permite elegir el rol. Crear primero un administrador y
después registrar las demás cuentas desde su panel en la aplicación.
Si las tablas se crearon manualmente, revisar su correspondencia con las
migraciones antes de aplicarlas; no borrar ni marcar versiones automáticamente.

Abrir <http://127.0.0.1:8000>. La interfaz utiliza rutas relativas y debe abrirse
desde FastAPI; Live Server no proporciona la API. La documentación interactiva
está en <http://127.0.0.1:8000/docs> y acepta el token mediante el botón Authorize.

Para archivos, configurar `SUPABASE_URL` y `SUPABASE_KEY` en el servidor y crear
el bucket privado `evidencias`. El CRUD sin archivos solo necesita PostgreSQL.
Nunca colocar claves de Supabase en JavaScript.

## Organización

- `index.html`, `css/`, `js/`: interfaz y separación modelo, vista y controlador.
- `quality/`: pruebas unitarias Jest, cobertura y ESLint del frontend.
- `backend/tests/`: pruebas pytest sin escritura en servicios reales.
- `docs/semana7/`: mediciones y evidencia técnica reproducible.
- `backend/app/routes/`: autenticación, cuentas, incidentes y evidencias.
- `backend/app/dependencies.py`: verificación del usuario activo y los roles.
- `backend/app/security.py`: hash PBKDF2-HMAC-SHA256 y JWT.
- `backend/app/schemas/`, `validation.py`: validación y normalización.
- `backend/app/services/`, `repositories/`, `models/`: reglas, persistencia y tablas.
- `backend/alembic/`: esquema de incidentes, evidencias y usuarios.

## Seguridad y permisos

Las contraseñas se almacenan con salt aleatorio y PBKDF2 de 600 000 iteraciones.
El JWT usa HS256, emisor fijo, firma y campos obligatorios; vence a los 30 minutos.
El rol se consulta en la base de datos, no se toma de información editable del cliente.

| Operación | Lector | Analista | Administrador |
|---|---|---|---|
| Consultar incidentes y acceder a evidencias | Sí | Sí | Sí |
| Crear, actualizar y subir evidencias | No | Sí | Sí |
| Eliminar incidentes o evidencias | No | No | Sí |
| Listar o crear cuentas | No | No | Sí |

`POST /api/auth/login` y `GET /api/salud` son públicos.
`GET /api/auth/me`, las cuentas y todos los endpoints de incidentes requieren
`Authorization: Bearer <token>`. No se devuelve el hash de contraseña.

El navegador mantiene el token únicamente en memoria, comprueba `/api/auth/me`,
envía el encabezado en las solicitudes y borra la sesión al cerrar, recargar,
vencer o recibir un 401. No persiste credenciales en localStorage.
La interfaz adapta las acciones al rol; la API comprueba los permisos incluso
si alguien modifica el HTML. El cierre cancela peticiones y limpia los datos visibles.

Las entradas admiten categorías y estados conocidos, fechas no futuras,
descripciones de 30 a 600 caracteres y responsables de 3 a 80 caracteres o vacíos.
Se normaliza Unicode y se rechazan controles no permitidos, campos desconocidos,
parches vacíos y nulos en campos obligatorios. La descripción permite saltos de
línea y tabulación. Las contraseñas no se recortan ni se normalizan.
SQLAlchemy utiliza parámetros y la vista inserta texto mediante `textContent`.

Los archivos se envían mediante multipart, con máximo de 5 MiB, extensión,
MIME y firma inicial coherentes. El servidor genera un nombre de almacenamiento
con UUID y obtiene enlaces firmados de diez minutos. Si falla la subida después
de guardar el incidente, el cliente conserva la edición del mismo registro para
reintentar sin duplicarlo. Los fallos de limpieza de Storage se registran.

## API y errores

| Método | Ruta | Uso |
|---|---|---|
| POST | `/api/auth/login` | Iniciar sesión |
| GET | `/api/auth/me` | Perfil autenticado |
| GET / POST | `/api/auth/usuarios` | Listar / crear cuentas |
| GET / POST | `/api/incidentes` | Listar / crear incidentes |
| GET / PUT / PATCH / DELETE | `/api/incidentes/{id}` | Consultar / reemplazar / actualizar / eliminar |
| POST / DELETE | `/api/incidentes/{id}/evidencia` | Subir / eliminar archivo |
| GET | `/api/incidentes/{id}/evidencia/acceso` | Obtener URL temporal |

La lista admite filtros `estado` y `prioridad`.
Los errores de la API usan `{"error": "mensaje"}`; datos inválidos responden 400,
acceso sin autenticación válida 401, permisos insuficientes 403, recurso inexistente
404, correo duplicado 409 y carga que excede el límite de lectura 413.
Crear responde 201 y eliminar correctamente responde 204 sin cuerpo.

## CORS y HTTPS

`CORS_ORIGINS` contiene orígenes explícitos separados por comas. No admite
comodines, rutas ni credenciales en los orígenes. Las peticiones admiten
Authorization y Content-Type, sin cookies de autenticación.
En producción se activa `APP_ENV=production` y se requieren orígenes HTTPS.
La guía [HTTPS](docs/HTTPS.md) incluye el proxy TLS, certificados, HSTS
y la configuración de encabezados reenviados.

Para desplegar esta aplicación desde GitHub con el `Dockerfile` de la raíz,
consultar la [guía de Docker y Render](docs/DESPLIEGUE_RENDER.md).

## Verificación técnica

Desde la raíz en Windows:

```powershell
npm test --prefix quality
npm run test:coverage --prefix quality
npm run lint --prefix quality
$env:PYTHONPATH = 'backend'
.\.venv\Scripts\python.exe -m pytest -q backend/tests
.\.venv\Scripts\python.exe -m compileall -q backend/app
```

`backend/benchmark_semana7.py` mide tres solicitudes autenticadas `GET
/api/incidentes` con una transacción PostgreSQL de solo lectura. Requiere un
usuario activo y la configuración local, pero no imprime tokens ni datos.
Ejecutarlo con `.\.venv\Scripts\python.exe backend/benchmark_semana7.py`.
El registro de resultados medidos, defectos y capturas pendientes está en
[RESULTADOS_TECNICOS.md](docs/semana7/RESULTADOS_TECNICOS.md).

Las pruebas pytest sustituyen los servicios de escritura por dobles en memoria.
No ejecutar pruebas de creación o eliminación sobre datos de uso real. La suite
heredada `test/` pertenece al antiguo servidor Express y no integra la API
FastAPI; `quality/` contiene las pruebas JavaScript actuales.

Para una comprobación manual, iniciar sesión como cada rol y revisar en Network
las respuestas de consulta, creación, actualización, borrado y evidencia.
Consultar sin token debe responder 401, un permiso insuficiente 403 y un dato
inválido 400. No incluir contraseñas, claves ni JWT completos en las capturas.
