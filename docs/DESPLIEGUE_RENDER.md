# Despliegue en Render con Docker

La imagen ejecuta FastAPI y sirve la interfaz HTML, CSS y JavaScript desde el
mismo origen. PostgreSQL y Supabase Storage siguen siendo servicios externos.
El contenedor no crea bases de datos ni ejecuta migraciones al arrancar.

## Preparación local

Desde la raíz del repositorio, en PowerShell:

```powershell
docker build -t incidentes-grupo8 .
docker compose config
docker compose up --build
```

`docker compose` lee `backend/.env` solo para esta prueba local. Si falta, copiar
`backend/.env.example` y completar las variables necesarias sin subir ese archivo
al repositorio. Compose publica `http://localhost:8000`; comprobar `/`,
`/api/salud` y `/docs`. Para detener el servicio, usar `Ctrl+C` y después
`docker compose down`.

También se puede ejecutar la imagen sin Compose:

```powershell
docker run --rm -p 8000:8000 --env-file backend/.env -e PORT=8000 incidentes-grupo8
```

No colocar `.env`, contraseñas ni claves en el Dockerfile ni en argumentos de
construcción. `.dockerignore` excluye estos archivos del contexto de imagen.

## Crear el Web Service

1. En [Render Dashboard](https://dashboard.render.com/), elegir **New > Web Service**.
2. Elegir **Git Provider**, conectar GitHub y seleccionar
   `nrguijarro1/tarea_grupo8_dp`. Seleccionar la rama `main`.
3. Seleccionar **Docker** como *Language*. Dejar la raíz del repositorio como
   *Root Directory* y usar `Dockerfile` en la raíz como *Dockerfile Path*.
4. No definir *Build Command*, *Start Command* ni *Docker Command*: Render
   construye el Dockerfile y utiliza su `CMD`. La imagen escucha en `0.0.0.0`
   y toma `PORT` del entorno; su valor local por defecto es `8000`.
5. En **Environment**, configurar las variables indicadas abajo. Render las
   entrega al proceso en tiempo de ejecución. No usar un archivo `.env` en Render.
6. Definir **Health Check Path** como `/api/salud` y activar **Auto-Deploy**
   desde `main`. Crear el servicio y revisar el despliegue y los logs.

Render suministra el valor de `PORT` (habitualmente `10000`), por lo que no es
necesario fijarlo en el panel. La URL pública tendrá HTTPS administrado por
Render. En ese entorno, Render realiza la redirección HTTPS en el borde y la
aplicación evita redirigir de nuevo el salto HTTP interno. Uvicorn acepta
encabezados reenviados solo de direcciones confiables según su configuración;
la aplicación no depende de ellos para aplicar la redirección en Render.

## Variables de entorno

Configurar en el panel de Render, sin incluir valores en Git:

| Variable | Uso |
| --- | --- |
| `DB_HOST` | Host PostgreSQL de Supabase. |
| `DB_PORT` | Puerto de la conexión elegida. |
| `DB_NAME` | Nombre de la base existente. |
| `DB_USER` | Usuario de la conexión elegida. |
| `DB_PASSWORD` | Contraseña de la base existente. |
| `DB_SSLMODE` | Usar `require` para exigir TLS. |
| `JWT_SECRET_KEY` | Clave existente de al menos 32 bytes; conservarla para los JWT activos. |
| `SUPABASE_URL` | URL del proyecto para Storage. |
| `SUPABASE_KEY` | Clave de servidor usada por Storage. |
| `CORS_ORIGINS` | URL HTTPS pública exacta, sin ruta ni barra final. |
| `APP_ENV` | `production`. |

Para conexiones desde una red que solo dispone de IPv4, obtener **Session
pooler** en **Supabase Dashboard > Connect** y copiar de allí `DB_HOST`,
`DB_PORT`, `DB_NAME` y `DB_USER` correspondientes. El pooler de sesión usa el
puerto `5432` y un usuario con el sufijo del proyecto. No confundirlo con el
pooler de transacciones del puerto `6543`. La aplicación conserva SQLAlchemy y
psycopg y no requiere cambiar el esquema. `DB_SSLMODE=require` cifra el enlace;
para verificar también el certificado y el host se necesita configurar
`verify-full` con el certificado raíz de Supabase disponible dentro del
contenedor. No ejecutar Alembic contra la base existente sin revisar antes su
estado y las migraciones aplicadas.

## Verificar el despliegue

Cuando Render proporcione la URL pública, abrir la interfaz en `/`, consultar
`/api/salud` (debe devolver `estado: ok`) y abrir `/docs`. Confirmar que CSS y
JavaScript cargan y que las llamadas del navegador van a `/api/...` en el mismo
origen HTTPS. Iniciar sesión con una cuenta existente y comprobar una consulta
de solo lectura a PostgreSQL; si corresponde, verificar el acceso a una
evidencia existente en el bucket privado. `/api/salud` solo confirma que la API
responde: no consulta PostgreSQL ni Storage. Si falla el despliegue, revisar
los logs de construcción e inicio en Render sin copiar secretos.

Referencias: [Docker en Render](https://render.com/docs/docker),
[Web Services y puerto](https://render.com/docs/web-services),
[Health Checks](https://render.com/docs/health-checks) y
[conexiones PostgreSQL de Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).
