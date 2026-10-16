import re
import logging
from pathlib import Path
from uuid import uuid4
from app.validation import limpiar_texto

from app.models.evidencia import Evidencia
from app.models.incidente import Incidente
from app.repositories.incidente_repository import IncidenteRepository
from app.schemas.incidente import (
    ESTADOS,
    PRIORIDADES,
    TIPOS,
    IncidenteCrear,
    IncidenteParcial,
    IncidenteReemplazo,
)


MAX_EVIDENCIA_BYTES = 5 * 1024 * 1024
logger = logging.getLogger(__name__)

MIME_PERMITIDOS = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "application/pdf": ".pdf",
}

EXTENSIONES_PERMITIDAS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".pdf",
}


class IncidenteService:

    def __init__(
        self,
        repository: IncidenteRepository,
    ):
        self.repository = repository

    # VALIDACIONES GENERALES

    def validar_id(
        self,
        incidente_id: int,
    ) -> int:

        if incidente_id <= 0:
            raise ValueError(
                "El identificador del incidente no es válido."
            )

        return incidente_id

    def validar_filtros(
        self,
        estado: str | None,
        prioridad: str | None,
    ) -> None:

        if estado and estado not in ESTADOS:
            raise ValueError(
                "El estado indicado no es válido."
            )

        if prioridad and prioridad not in PRIORIDADES:
            raise ValueError(
                "La prioridad indicada no es válida."
            )

    def presentar(
        self,
        incidente: Incidente,
        evidencia: Evidencia | None = None,
    ) -> dict:

        incidente_id = int(
            incidente.id
        )

        return {
            "id": incidente_id,

            "codigo":
                f"INC-{incidente_id:03d}",

            "tipo":
                incidente.tipo,

            "tipoTexto":
                TIPOS.get(
                    incidente.tipo,
                    incidente.tipo,
                ),

            "fecha":
                incidente.fecha,

            "prioridad":
                incidente.prioridad,

            "estado":
                incidente.estado,

            "responsable":
                incidente.responsable
                or "No especificado",

            "descripcion":
                incidente.descripcion,

            "creado_por":
                incidente.creado_por,

            "evidencia":
                evidencia.nombre_original
                if evidencia
                else "Sin evidencia adjunta",

            "created_at":
                incidente.created_at,

            "updated_at":
                incidente.updated_at,
        }
    # CRUD

    def listar(
        self,
        estado: str | None = None,
        prioridad: str | None = None,
    ) -> list[dict]:

        self.validar_filtros(
            estado,
            prioridad,
        )

        incidentes = (
            self.repository.listar(
                estado=estado,
                prioridad=prioridad,
            )
        )

        ids = [
            int(incidente.id)
            for incidente in incidentes
        ]

        evidencias = (
            self.repository
            .listar_evidencias(ids)
        )

        evidencia_por_incidente = {
            int(evidencia.incidente_id):
                evidencia

            for evidencia in evidencias
        }

        return [
            self.presentar(
                incidente,
                evidencia_por_incidente.get(
                    int(incidente.id)
                ),
            )

            for incidente in incidentes
        ]

    def buscar_por_id(
        self,
        incidente_id: int,
    ) -> dict:

        incidente_id = self.validar_id(
            incidente_id
        )

        incidente = (
            self.repository
            .buscar_por_id(
                incidente_id
            )
        )

        if incidente is None:
            raise LookupError(
                "Incidente no encontrado."
            )

        evidencia = (
            self.repository
            .buscar_evidencia(
                incidente_id
            )
        )

        return self.presentar(
            incidente,
            evidencia,
        )

    def registrar(
        self,
        datos: IncidenteCrear,
        usuario_id: int,
    ) -> dict:

        # El usuario creador se obtiene del JWT validado en FastAPI,
        # nunca de datos enviados por el cliente.
        if usuario_id <= 0:
            raise ValueError("El identificador del usuario no es válido.")

        # Se mantienen objetos Python, especialmente datetime.date.
        payload = datos.model_dump()
        payload["creado_por"] = usuario_id

        incidente = (
            self.repository
            .crear(payload)
        )

        return self.presentar(
            incidente
        )

    def reemplazar(
        self,
        incidente_id: int,
        datos: IncidenteReemplazo,
    ) -> dict:

        self.buscar_por_id(
            incidente_id
        )

        payload = datos.model_dump()

        incidente = (
            self.repository
            .actualizar(
                incidente_id,
                payload,
            )
        )

        evidencia = (
            self.repository
            .buscar_evidencia(
                incidente_id
            )
        )

        return self.presentar(
            incidente,
            evidencia,
        )

    def actualizar_parcialmente(
        self,
        incidente_id: int,
        datos: IncidenteParcial,
    ) -> dict:

        self.buscar_por_id(
            incidente_id
        )

        payload = datos.model_dump(
            exclude_unset=True
        )

        incidente = (
            self.repository
            .actualizar(
                incidente_id,
                payload,
            )
        )

        evidencia = (
            self.repository
            .buscar_evidencia(
                incidente_id
            )
        )

        return self.presentar(
            incidente,
            evidencia,
        )

    def eliminar(
        self,
        incidente_id: int,
    ) -> None:

        self.buscar_por_id(
            incidente_id
        )

        evidencia = (
            self.repository
            .buscar_evidencia(
                incidente_id
            )
        )

        storage_path = (
            evidencia.storage_path
            if evidencia
            else None
        )

        self.repository.eliminar(
            incidente_id
        )

        if storage_path:

            try:
                self.repository.eliminar_archivo(
                    storage_path
                )

            except Exception:
                # La eliminación de Storage
                # no debe restaurar el registro
                # ya eliminado de PostgreSQL.
                logger.warning("Incidente eliminado; quedó pendiente limpiar su archivo en Storage.")

    # ==========================================
    # EVIDENCIAS
    # ==========================================

    def subir_evidencia(
        self,
        incidente_id: int,
        nombre: str,
        contenido: bytes,
        mime_type: str,
    ) -> dict:

        self.buscar_por_id(
            incidente_id
        )

        if not nombre:
            raise ValueError(
                "El archivo debe tener un nombre."
            )

        if not contenido:
            raise ValueError(
                "El archivo está vacío."
            )

        if len(contenido) > MAX_EVIDENCIA_BYTES:
            raise ValueError(
                "El archivo no debe superar los 5 MB."
            )

        mime_type = (
            mime_type
            or "application/octet-stream"
        ).lower()

        if mime_type not in MIME_PERMITIDOS:
            raise ValueError(
                "Solo se permiten archivos PNG, JPG o PDF."
            )

        nombre_original = limpiar_texto(Path(nombre.replace("\\", "/")).name)

        extension = (
            Path(nombre_original)
            .suffix
            .lower()
        )

        if extension not in EXTENSIONES_PERMITIDAS:
            raise ValueError(
                "Solo se permiten archivos PNG, JPG o PDF."
            )

        if len(nombre_original) > 200:
            raise ValueError(
                "El nombre de la evidencia no puede "
                "superar 200 caracteres."
            )

        extension_mime = MIME_PERMITIDOS[mime_type]
        if (".jpg" if extension == ".jpeg" else extension) != extension_mime:
            raise ValueError("La extensión no coincide con el tipo de archivo.")

        firmas = {
            "image/png": b"\x89PNG\r\n\x1a\n",
            "image/jpeg": b"\xff\xd8\xff",
            "application/pdf": b"%PDF-",
        }
        if not contenido.startswith(firmas[mime_type]):
            raise ValueError("El contenido no coincide con el tipo de archivo declarado.")

        nombre_seguro = re.sub(
            r"[^A-Za-z0-9._-]",
            "_",
            nombre_original,
        )

        identificador = uuid4().hex

        storage_path = (
            f"incidentes/"
            f"{incidente_id}/"
            f"{identificador}_"
            f"{nombre_seguro}"
        )

        evidencia_anterior = (
            self.repository
            .buscar_evidencia(
                incidente_id
            )
        )

        storage_path_anterior = (
            evidencia_anterior.storage_path
            if evidencia_anterior
            else None
        )

        # Primero sube el archivo.
        self.repository.subir_archivo(
            storage_path,
            contenido,
            mime_type,
        )

        datos_evidencia = {
            "incidente_id":
                incidente_id,

            "nombre_original":
                nombre_original,

            "storage_path":
                storage_path,

            "mime_type":
                mime_type,

            "tamano_bytes":
                len(contenido),
        }

        try:

            evidencia = (
                self.repository
                .guardar_evidencia(
                    datos_evidencia
                )
            )

        except Exception:

            try:
                self.repository.eliminar_archivo(
                    storage_path
                )
            finally:
                raise

        if (
            storage_path_anterior
            and storage_path_anterior
            != storage_path
        ):

            try:
                self.repository.eliminar_archivo(
                    storage_path_anterior
                )

            except Exception:
                logger.warning("Evidencia reemplazada; quedó pendiente limpiar el archivo anterior en Storage.")

        return {
            "id":
                evidencia.id,

            "incidente_id":
                evidencia.incidente_id,

            "nombre_original":
                evidencia.nombre_original,

            "storage_path":
                evidencia.storage_path,

            "mime_type":
                evidencia.mime_type,

            "tamano_bytes":
                evidencia.tamano_bytes,
        }

    def obtener_url_evidencia(
        self,
        incidente_id: int,
    ) -> dict:

        self.buscar_por_id(
            incidente_id
        )

        evidencia = (
            self.repository
            .buscar_evidencia(
                incidente_id
            )
        )

        if evidencia is None:
            raise LookupError(
                "El incidente no tiene "
                "una evidencia adjunta."
            )

        url = (
            self.repository
            .crear_url_firmada(
                evidencia.storage_path,
                600,
            )
        )

        return {
            "nombre":
                evidencia.nombre_original,

            "url":
                url,

            "expira_en":
                600,
        }

    def eliminar_evidencia(
        self,
        incidente_id: int,
    ) -> None:

        self.buscar_por_id(
            incidente_id
        )

        evidencia = (
            self.repository
            .buscar_evidencia(
                incidente_id
            )
        )

        if evidencia is None:
            raise LookupError(
                "El incidente no tiene "
                "una evidencia adjunta."
            )

        storage_path = (
            evidencia.storage_path
        )

        self.repository \
            .eliminar_registro_evidencia(
                incidente_id
            )

        try:
            self.repository.eliminar_archivo(
                storage_path
            )

        except Exception:
            logger.warning("Evidencia eliminada; quedó pendiente limpiar su archivo en Storage.")
