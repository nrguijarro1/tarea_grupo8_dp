from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload
from supabase import Client
from app.config import get_supabase

from app.models.incidente import Incidente
from app.models.evidencia import Evidencia


BUCKET_EVIDENCIAS = "evidencias"


class IncidenteRepository:
    def __init__(
        self,
        db: Session,
        supabase: Client | None = None,
    ):
        self.db = db
        self._supabase = supabase

    @property
    def supabase(self) -> Client:
        # El CRUD en PostgreSQL no requiere contactar Storage.
        if self._supabase is None:
            self._supabase = get_supabase()
        return self._supabase

    # ==========================================
    # INCIDENTES - SQLALCHEMY ORM
    # ==========================================

    def listar(
        self,
        estado: str | None = None,
        prioridad: str | None = None,
    ) -> list[Incidente]:

        # La lista siempre presenta la evidencia: una unión evita otra ida a PostgreSQL.
        stmt = select(Incidente).options(joinedload(Incidente.evidencia))

        if estado:
            stmt = stmt.where(
                Incidente.estado == estado
            )

        if prioridad:
            stmt = stmt.where(
                Incidente.prioridad == prioridad
            )

        stmt = stmt.order_by(
            Incidente.id.desc()
        )

        return list(
            self.db.scalars(stmt).all()
        )

    def buscar_por_id(
        self,
        incidente_id: int,
    ) -> Incidente | None:

        stmt = (
            select(Incidente)
            .where(
                Incidente.id == incidente_id
            )
        )

        return self.db.scalar(stmt)

    def crear(
        self,
        datos: dict,
    ) -> Incidente:

        incidente = Incidente(**datos)

        try:
            self.db.add(incidente)
            self.db.commit()
            self.db.refresh(incidente)

            return incidente

        except Exception:
            self.db.rollback()
            raise

    def actualizar(
        self,
        incidente_id: int,
        datos: dict,
    ) -> Incidente:

        incidente = self.buscar_por_id(
            incidente_id
        )

        if incidente is None:
            raise LookupError(
                "Incidente no encontrado."
            )

        try:
            for campo, valor in datos.items():

                if hasattr(incidente, campo):
                    setattr(
                        incidente,
                        campo,
                        valor,
                    )

            incidente.updated_at = datetime.now(timezone.utc)

            self.db.commit()
            self.db.refresh(incidente)

            return incidente

        except Exception:
            self.db.rollback()
            raise

    def eliminar(
        self,
        incidente_id: int,
    ) -> None:

        incidente = self.buscar_por_id(
            incidente_id
        )

        if incidente is None:
            raise LookupError(
                "Incidente no encontrado."
            )

        try:
            self.db.delete(incidente)
            self.db.commit()

        except Exception:
            self.db.rollback()
            raise

    # ==========================================
    # EVIDENCIAS - SQLALCHEMY ORM
    # ==========================================

    def buscar_evidencia(
        self,
        incidente_id: int,
    ) -> Evidencia | None:

        stmt = (
            select(Evidencia)
            .where(
                Evidencia.incidente_id
                == incidente_id
            )
        )

        return self.db.scalar(stmt)

    def listar_evidencias(
        self,
        incidentes_ids: list[int],
    ) -> list[Evidencia]:

        if not incidentes_ids:
            return []

        stmt = (
            select(Evidencia)
            .where(
                Evidencia.incidente_id.in_(
                    incidentes_ids
                )
            )
        )

        return list(
            self.db.scalars(stmt).all()
        )

    def guardar_evidencia(
        self,
        datos: dict,
    ) -> Evidencia:

        incidente_id = datos[
            "incidente_id"
        ]

        evidencia = self.buscar_evidencia(
            incidente_id
        )

        try:

            if evidencia is None:

                evidencia = Evidencia(
                    **datos
                )

                self.db.add(
                    evidencia
                )

            else:

                evidencia.nombre_original = (
                    datos["nombre_original"]
                )

                evidencia.storage_path = (
                    datos["storage_path"]
                )

                evidencia.mime_type = (
                    datos["mime_type"]
                )

                evidencia.tamano_bytes = (
                    datos["tamano_bytes"]
                )

            self.db.commit()
            self.db.refresh(evidencia)

            return evidencia

        except Exception:
            self.db.rollback()
            raise

    def eliminar_registro_evidencia(
        self,
        incidente_id: int,
    ) -> None:

        evidencia = self.buscar_evidencia(
            incidente_id
        )

        if evidencia is None:
            return

        try:
            self.db.delete(evidencia)
            self.db.commit()

        except Exception:
            self.db.rollback()
            raise

    # ==========================================
    # SUPABASE STORAGE
    # ==========================================

    def subir_archivo(
        self,
        storage_path: str,
        contenido: bytes,
        mime_type: str,
    ) -> None:

        self.supabase.storage \
            .from_(BUCKET_EVIDENCIAS) \
            .upload(
                path=storage_path,
                file=contenido,
                file_options={
                    "content-type": mime_type,
                    "upsert": "false",
                },
            )

    def eliminar_archivo(
        self,
        storage_path: str,
    ) -> None:

        self.supabase.storage \
            .from_(BUCKET_EVIDENCIAS) \
            .remove([
                storage_path
            ])

    def crear_url_firmada(
        self,
        storage_path: str,
        segundos: int = 600,
    ) -> str:

        respuesta = (
            self.supabase.storage
            .from_(BUCKET_EVIDENCIAS)
            .create_signed_url(
                storage_path,
                segundos,
            )
        )

        if isinstance(respuesta, dict):

            url = (
                respuesta.get("signedURL")
                or respuesta.get("signedUrl")
                or respuesta.get("signed_url")
            )

            if url:
                return url

        raise RuntimeError(
            "No se pudo generar la URL "
            "temporal de la evidencia."
        )
