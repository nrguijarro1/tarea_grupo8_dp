
from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)

from sqlalchemy.orm import Session

from app.database import get_db
from app.models.usuario import Usuario
from app.dependencies import (
    obtener_usuario_actual,
    exigir_roles,
)
from app.repositories.incidente_repository import (
    IncidenteRepository,
)
from app.schemas.incidente import (
    IncidenteCrear,
    IncidenteParcial,
    IncidenteReemplazo,
)
from app.services.incidente_service import (
    IncidenteService,
    MAX_EVIDENCIA_BYTES,
)


# ==========================================
# CONFIGURACION DEL ROUTER
# ==========================================

router = APIRouter(
    prefix="/api/incidentes",
    tags=["Incidentes"],
    dependencies=[
        Depends(obtener_usuario_actual)
    ],
)


# ==========================================
# DEPENDENCIAS
# ==========================================

def get_service(
    db: Session = Depends(get_db),
) -> IncidenteService:

    repository = IncidenteRepository(
        db=db,
    )

    return IncidenteService(
        repository
    )


def manejar_error(
    error: Exception,
):

    if isinstance(error, LookupError):
        raise HTTPException(
            status_code=404,
            detail=str(error),
        )

    if isinstance(error, ValueError):
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    raise error


# ==========================================
# CRUD DE INCIDENTES
# ==========================================

# CONSULTAR TODOS LOS INCIDENTES
# Roles: administrador, analista y lector

@router.get("")
def listar_incidentes(
    estado: str | None = Query(
        default=None,
        description="Filtrar incidentes por estado.",
    ),
    prioridad: str | None = Query(
        default=None,
        description="Filtrar incidentes por prioridad.",
    ),
    service: IncidenteService = Depends(
        get_service
    ),
):

    try:
        return service.listar(
            estado=estado,
            prioridad=prioridad,
        )

    except Exception as error:
        manejar_error(error)


# CONSULTAR INCIDENTE POR ID
# Roles: administrador, analista y lector

@router.get(
    "/{incidente_id}"
)
def obtener_incidente(
    incidente_id: int,
    service: IncidenteService = Depends(
        get_service
    ),
):

    try:
        return service.buscar_por_id(
            incidente_id
        )

    except Exception as error:
        manejar_error(error)


# CREAR INCIDENTE
# Roles: administrador y analista

@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    dependencies=[
        Depends(
            exigir_roles(
                "administrador",
                "analista",
            )
        )
    ],
)
def crear_incidente(
    datos: IncidenteCrear,
    usuario: Usuario = Depends(obtener_usuario_actual),
    service: IncidenteService = Depends(
        get_service
    ),
):

    try:
        return service.registrar(
            datos,
            usuario_id=usuario.id,
        )

    except Exception as error:
        manejar_error(error)


# REEMPLAZAR INCIDENTE
# Roles: administrador y analista

@router.put(
    "/{incidente_id}",
    dependencies=[
        Depends(
            exigir_roles(
                "administrador",
                "analista",
            )
        )
    ],
)
def reemplazar_incidente(
    incidente_id: int,
    datos: IncidenteReemplazo,
    service: IncidenteService = Depends(
        get_service
    ),
):

    try:
        return service.reemplazar(
            incidente_id,
            datos,
        )

    except Exception as error:
        manejar_error(error)


# ACTUALIZAR PARCIALMENTE
# Roles: administrador y analista

@router.patch(
    "/{incidente_id}",
    dependencies=[
        Depends(
            exigir_roles(
                "administrador",
                "analista",
            )
        )
    ],
)
def actualizar_incidente(
    incidente_id: int,
    datos: IncidenteParcial,
    service: IncidenteService = Depends(
        get_service
    ),
):

    try:
        return (
            service
            .actualizar_parcialmente(
                incidente_id,
                datos,
            )
        )

    except Exception as error:
        manejar_error(error)


# ELIMINAR INCIDENTE
# Rol: solo administrador

@router.delete(
    "/{incidente_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[
        Depends(
            exigir_roles("administrador")
        )
    ],
)
def eliminar_incidente(
    incidente_id: int,
    service: IncidenteService = Depends(
        get_service
    ),
):

    try:
        service.eliminar(
            incidente_id
        )

        return Response(
            status_code=204
        )

    except Exception as error:
        manejar_error(error)


# ==========================================
# GESTION DE EVIDENCIAS
# ==========================================

# SUBIR EVIDENCIA
# Roles: administrador y analista

@router.post(
    "/{incidente_id}/evidencia",
    status_code=status.HTTP_201_CREATED,
    dependencies=[
        Depends(
            exigir_roles(
                "administrador",
                "analista",
            )
        )
    ],
)
async def subir_evidencia(
    incidente_id: int,
    archivo: UploadFile = File(...),
    service: IncidenteService = Depends(
        get_service
    ),
):

    try:

        # No cargar un archivo ilimitado en memoria antes de validarlo.
        contenido = await archivo.read(MAX_EVIDENCIA_BYTES + 1)
        if len(contenido) > MAX_EVIDENCIA_BYTES:
            raise HTTPException(status_code=413, detail="El archivo no debe superar los 5 MB.")

        evidencia = service.subir_evidencia(
            incidente_id=incidente_id,
            nombre=(
                archivo.filename or ""
            ),
            contenido=contenido,
            mime_type=(
                archivo.content_type or ""
            ),
        )

        return {
            "mensaje": (
                "Evidencia guardada correctamente."
            ),
            "evidencia": evidencia,
        }

    except Exception as error:
        manejar_error(error)

    finally:
        await archivo.close()


# CONSULTAR ACCESO A EVIDENCIA
# Roles: administrador, analista y lector

@router.get(
    "/{incidente_id}/evidencia/acceso"
)
def obtener_evidencia(
    incidente_id: int,
    service: IncidenteService = Depends(
        get_service
    ),
):

    try:
        return (
            service
            .obtener_url_evidencia(
                incidente_id
            )
        )

    except Exception as error:
        manejar_error(error)


# ELIMINAR EVIDENCIA
# Rol: solo administrador

@router.delete(
    "/{incidente_id}/evidencia",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[
        Depends(
            exigir_roles("administrador")
        )
    ],
)
def eliminar_evidencia(
    incidente_id: int,
    service: IncidenteService = Depends(
        get_service
    ),
):

    try:
        service.eliminar_evidencia(
            incidente_id
        )

        return Response(
            status_code=204
        )

    except Exception as error:
        manejar_error(error)
