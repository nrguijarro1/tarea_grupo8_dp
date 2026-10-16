# Semana 7: resultados técnicos comprobados

Fecha local: 16 de octubre de 2026. Base Git: `1f8019bdc15f85e985bcb0cecec09bbaa2faae4b` en `main`.

## Situación inicial

- Repositorio FastAPI, PostgreSQL, SQLAlchemy, Supabase Storage y frontend MVC. Había archivos Express **sin seguimiento** (`package.json`, `server.js`, `src/`, etc.); se conservaron intactos. Las herramientas Node se instalaron en `quality/` para no sobrescribirlos.
- El entorno virtual anterior fuera del repositorio apuntaba a `C:\Users\ASUS\...\Python314\python.exe`, que ya no existe. Se creó `.venv` local ignorado por Git y se instalaron las dependencias de `backend/requirements.txt`. `backend/.env` permaneció intacto.
- `PYTHONPATH=backend; .venv/Scripts/python.exe -m pytest -q backend/tests`: **27 aprobadas, 0 fallidas, 1 advertencia** (`StarletteDeprecationWarning` sobre `httpx` en TestClient; no afectó las pruebas).
- No había configuración de Jest ni ESLint en la versión FastAPI rastreada. Tras configurar ESLint, el primer análisis de `js/` y `quality/tests/` informó **0 errores y 0 advertencias**; el análisis final mantuvo ese resultado. No se desactivó ninguna regla global para limpiar hallazgos.
- Herramientas de medición: Python 3.14, Node.js 22.23.3 portátil, Jest 30, ESLint 9 y TestClient contra PostgreSQL real mediante transacciones de **solo lectura**. No se escribieron registros reales.

## Defectos corregidos

### 1. `updated_at` permanecía igual al editar

Reproducción: consultar un incidente, anotar `updated_at`, cambiar un campo mediante `PUT /api/incidentes/{id}` o `PATCH /api/incidentes/{id}` con token de analista o administrador y consultar de nuevo. Se esperaba una marca de modificación nueva; `IncidenteRepository.actualizar` solo cambiaba los campos recibidos y devolvía el mismo `updated_at` porque el modelo tenía únicamente un valor inicial por defecto. La respuesta exitosa es **200** y contiene el objeto del incidente. En la prueba aislada, el valor anterior era del día previo y seguía idéntico tras actualizar. La prueba `test_actualizar_renueva_fecha_de_modificacion` falló con `AssertionError` antes del ajuste y pasó después. El repositorio ahora asigna la hora UTC al actualizar; no cambió el contrato HTTP.

Chrome DevTools pendiente: en **Network**, filtrar `incidentes`, abrir el `PUT` o `PATCH` y comparar los campos `updated_at` de las respuestas `GET` anterior y posterior. En **Console**, comprobar que no aparezcan errores. En **Sources**, colocar un punto de interrupción en `js/model.js` dentro de `updateIncident` y verificar que la respuesta nueva llega al modelo. No se usó un navegador durante esta ejecución.

### 2. Descripción con carácter invisible atravesaba la validación web

Reproducción: como analista, completar un incidente válido y pegar `\u200B` (espacio de ancho cero) dentro de una descripción de al menos 30 caracteres. Antes, `IncidentController.validateField` solo comprobaba longitud, por lo que enviaba `POST /api/incidentes`; el backend respondía **400** con `{"error":"El texto contiene caracteres de control no permitidos."}`. Se esperaba que el formulario lo detectara antes de enviar. La prueba Jest `rechaza caracteres de formato invisibles...` falló antes con mensaje vacío y pasó después. `js/rules.js` valida ahora la categoría Unicode `C`, manteniendo permitidos tabulación y saltos de línea igual que Python.

Chrome DevTools pendiente: en **Network**, confirmar que el `POST` ya no se envía al pulsar Guardar con esa descripción; si se llama manualmente a la API, observar el **400**. En **Console**, verificar que no aparezcan errores de JavaScript. En **Sources**, poner un punto de interrupción en `fieldRules.descripcion` de `js/rules.js` y comprobar el mensaje. No se capturaron pantallas automáticamente.

## Pruebas y cobertura

| Comando | Resultado final |
|---|---|
| `npm test --prefix quality` | 4 suites, **19 pruebas aprobadas**, 0 fallidas |
| `npm run test:coverage --prefix quality` | 19 aprobadas; cobertura V8 de `js/model.js` y `js/rules.js`: **76,64 % instrucciones y líneas**, **89,06 % ramas**, **66,66 % funciones** |
| `npm run lint --prefix quality` | 0 errores, 0 advertencias |
| `PYTHONPATH=backend; .venv/Scripts/python.exe -m pytest -q backend/tests` | **28 aprobadas**, 0 fallidas, 1 advertencia de TestClient |
| `python -m compileall -q backend/app` | Sin errores de sintaxis |

La cobertura se limita a las reglas y al modelo frontend indicados en Jest; no es cobertura global de toda la aplicación. Con el proveedor Babel, Jest mostró 0 % pese a ejecutar pruebas; se configuró V8 y se confirmó cobertura real de los archivos importados. Las pruebas Python sustituyen las operaciones de escritura por objetos en memoria. La comprobación de rutas devolvió 200 para `/`, `/js/rules.js` y `/api/salud`, y 401 para `GET /api/incidentes` sin token.

## Rendimiento medido

`backend/benchmark_semana7.py` ejecutó tres `GET /api/incidentes` autenticados, en TestClient ASGI, con conexión PostgreSQL de solo lectura y 6 incidentes. `SELECT` incluye una consulta de usuario para autenticar; el listado pasó de **dos consultas SQL** (incidentes + evidencias) a **una** mediante `joinedload` en el repositorio. No se creó índice ni paginación: con seis registros no existe justificación medible para ello. Los tiempos incluyen autenticación y acceso a PostgreSQL; no son tiempos de Chrome ni garantizan la misma mejora en otros entornos.

| Ejecución | Antes: ms / SELECT / bytes | Después: ms / SELECT / bytes |
|---|---:|---:|
| 1 | 636,41 / 3 / 2711 | 549,22 / 2 / 2711 |
| 2 | 589,27 / 3 / 2711 | 497,41 / 2 / 2711 |
| 3 | 587,13 / 3 / 2711 | 505,50 / 2 / 2711 |
| Mediana | **589,27 ms** | **505,50 ms** |

En el flujo de subida de evidencia, una prueba Jest reprodujo el `GET /api/incidentes` adicional después del `POST /api/incidentes/{id}/evidencia` (una llamada) y confirmó **cero llamadas GET** después del cambio. El modelo usa `evidencia.nombre_original` de la respuesta 201 para actualizar el incidente local. El listado medido de 2711 bytes indica el tamaño de esa respuesta GET que se evita con los seis registros actuales; **no se midió tiempo real de subida ni tráfico de navegador**. Las cabeceras de autenticación, `Cache-Control: no-store` y permisos no se alteraron.

### Imagen

La búsqueda de `*.png`, `*.jpg`, `*.jpeg`, `*.webp`, `*.gif`, `*.svg`, referencias `<img>`, `<svg>`, `data:image` y `url(...)` en los recursos rastreados no encontró una imagen de interfaz que pueda medirse u optimizarse. Las evidencias de usuarios están en Supabase Storage y no se descargaron ni modificaron. **No hay cifras antes/después ni optimización de imagen verificable**. Para completar esta parte se necesita un recurso visual aprobado y sus bytes, formato, dimensiones y condiciones de carga antes de comprimirlo.

## Refactorización y regresión

Las reglas de formulario y filtrado salieron de `js/controller.js` hacia `js/rules.js`: el controlador coordina eventos y solicitudes; la vista conserva DOM y presentación; el modelo conserva HTTP y estado. En el backend, el repositorio carga la evidencia del listado y el servicio presenta los datos. Se preservaron estados, roles, JWT, rutas HTTP y manejo de Supabase. Las pruebas de autenticación, roles, CRUD y validación existentes aprobaron tras los cambios; la evidencia real de Storage no se probó porque requiere escribir en el servicio externo.

## Capturas manuales pendientes

1. DevTools **Network**: `GET /api/incidentes` autenticado, estado 200, tiempo, tamaño de transferencia y número de solicitudes; repetir tres veces en condiciones equivalentes. Ocultar el JWT.
2. DevTools **Network**: `POST` de evidencia válido y ausencia del antiguo `GET /api/incidentes` inmediato; anotar tiempos y bytes reales, sin mostrar nombres sensibles.
3. DevTools **Network**: edición autorizada y comparación visible de `updated_at` antes y después, con estado 200.
4. DevTools **Sources** y formulario: punto de interrupción en `fieldRules.descripcion`, mensaje por `\u200B` y ausencia del `POST` inválido en Network.
5. DevTools **Console**: ausencia o detalle de errores durante los dos casos anteriores.
6. Evidencia de un recurso visual real, si el equipo decide incorporarlo: dimensiones, formato, bytes y mediciones antes/después; actualmente no existe tal recurso en el proyecto.

No se generaron capturas ni resultados visuales ficticios. La medición de red fue en TestClient, no en Chrome. El archivo `.env` y la base de producción no se modificaron.
