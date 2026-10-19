
import logging
import os
from contextlib import asynccontextmanager
from urllib.parse import urlsplit

from pathlib import Path

from dotenv import load_dotenv

from fastapi import (
    FastAPI,
    HTTPException,
    Request,
)

from fastapi.exceptions import (
    RequestValidationError,
)

from fastapi.middleware.cors import (
    CORSMiddleware,
)
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware
from app.security import obtener_clave_jwt

from fastapi.responses import (
    FileResponse,
    JSONResponse,
)

from fastapi.staticfiles import StaticFiles

from app.routes.auth import router as auth_router
from app.routes.incidentes import (
    router as incidentes_router,
)


# ==========================================
# CONFIGURACION GENERAL
# ==========================================

logging.basicConfig(
    level=logging.INFO
)

logger = logging.getLogger(__name__)


# Directorios del proyecto
BACKEND_DIR = (
    Path(__file__).resolve().parents[1]
)

PROJECT_ROOT = (
    Path(__file__).resolve().parents[2]
)

# Cargar variables de entorno
load_dotenv(BACKEND_DIR / ".env")


# ==========================================
# CONFIGURACION FASTAPI
# ==========================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    obtener_clave_jwt()
    yield


app = FastAPI(
    lifespan=lifespan,
    title="API de Gestión de Incidentes",
    description=(
        "API REST para la gestión segura "
        "de incidentes de ciberseguridad. "
        "Incluye autenticación JWT, "
        "control de roles y operaciones CRUD."
    ),
    version="2.1.0",
)


# ==========================================
# CONFIGURACION CORS
# ==========================================

# Origenes permitidos para desarrollo.
# En produccion se configuran mediante
# CORS_ORIGINS en el archivo .env.

origenes_default = (
    "http://127.0.0.1:8000,"
    "http://localhost:8000,"
    "http://127.0.0.1:5500,"
    "http://localhost:5500"
)

origenes_configurados = os.getenv(
    "CORS_ORIGINS",
    origenes_default,
)

origenes_permitidos = [
    origen.strip().rstrip("/")
    for origen in origenes_configurados.split(",")
    if origen.strip()
]

produccion = os.getenv("APP_ENV", "development").lower() == "production"
for origen in origenes_permitidos:
    partes = urlsplit(origen)
    if (partes.scheme not in {"http", "https"} or not partes.netloc
            or partes.username or partes.password or partes.path
            or partes.query or partes.fragment or "*" in origen):
        raise RuntimeError("CORS_ORIGINS debe contener orígenes explícitos sin rutas ni comodines.")
    if produccion and partes.scheme != "https":
        raise RuntimeError("En producción, CORS_ORIGINS solo admite HTTPS.")


@app.middleware("http")
async def proteger_respuesta(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    # Swagger UI necesita recursos externos; esta política protege la interfaz propia.
    if request.url.path == "/":
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self'; "
            "img-src 'self'; connect-src 'self'; object-src 'none'; "
            "base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
        )
    if request.url.path.startswith("/api/") or request.url.path == "/":
        response.headers["Cache-Control"] = "no-store"
    if produccion and (request.url.scheme == "https" or os.getenv("RENDER") == "true"):
        response.headers["Strict-Transport-Security"] = "max-age=31536000"
    return response


# Render termina TLS y redirige HTTP antes de reenviar la solicitud al contenedor.
# El salto interno llega por HTTP, incluso cuando el navegador usa HTTPS.
if produccion and os.getenv("RENDER") != "true":
    app.add_middleware(HTTPSRedirectMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origenes_permitidos,
    allow_credentials=False,
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=[
        "Authorization",
        "Content-Type",
    ],
    max_age=600,
)


# ==========================================
# REGISTRO DE RUTAS
# ==========================================

# Rutas de autenticacion
app.include_router(
    auth_router
)

# Rutas protegidas de incidentes
app.include_router(
    incidentes_router
)


# ==========================================
# MANEJO DE ERRORES HTTP
# ==========================================

@app.exception_handler(HTTPException)
async def http_exception_handler(
    request: Request,
    exc: HTTPException,
):
    """
    Maneja errores HTTP, incluyendo
    errores de autenticacion y permisos.
    """

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail
        },
        headers=exc.headers,
    )


# ==========================================
# VALIDACION DE DATOS
# ==========================================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
):
    """
    Maneja las solicitudes que contienen
    datos invalidos o mal formados.
    """

    errores = exc.errors()

    mensaje = "Datos inválidos."

    if errores:
        mensaje = errores[0].get(
            "msg",
            mensaje,
        )

        if mensaje.startswith("Value error, "):
            mensaje = mensaje.replace(
                "Value error, ",
                "",
                1,
            )

    return JSONResponse(
        status_code=400,
        content={
            "error": mensaje
        },
    )


# ==========================================
# ERRORES INTERNOS
# ==========================================

@app.exception_handler(Exception)
async def internal_exception_handler(
    request: Request,
    exc: Exception,
):
    """
    Registra errores internos sin revelar
    informacion sensible al cliente.
    """

    logger.exception(
        "Error interno del servidor"
    )

    return JSONResponse(
        status_code=500,
        content={
            "error": (
                "Error interno del servidor."
            )
        },
    )


# ==========================================
# RUTA DE SALUD
# ==========================================

@app.get(
    "/api/salud",
    tags=["Sistema"],
)
def salud():
    """
    Verifica que la API se encuentre activa.
    """

    return {
        "estado": "ok",
        "servicio": (
            "API de Gestión de Incidentes"
        ),
        "version": "2.1.0",
    }


# ==========================================
# FRONTEND HTML, CSS Y JAVASCRIPT
# ==========================================

CSS_DIR = PROJECT_ROOT / "css"
JS_DIR = PROJECT_ROOT / "js"
INDEX_FILE = PROJECT_ROOT / "index.html"


# Servir archivos CSS
if CSS_DIR.exists():
    app.mount(
        "/css",
        StaticFiles(
            directory=CSS_DIR
        ),
        name="css",
    )


# Servir archivos JavaScript
if JS_DIR.exists():
    app.mount(
        "/js",
        StaticFiles(
            directory=JS_DIR
        ),
        name="js",
    )


# ==========================================
# PAGINA PRINCIPAL
# ==========================================

@app.get(
    "/",
    include_in_schema=False,
)
def frontend():
    """
    Carga la interfaz HTML de la plataforma.
    """

    if not INDEX_FILE.exists():
        return {
            "mensaje": (
                "API funcionando. "
                "No se encontró index.html."
            )
        }

    return FileResponse(
        INDEX_FILE
    )
