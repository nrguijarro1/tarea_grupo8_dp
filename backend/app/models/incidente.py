from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Identity,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Incidente(Base):
    __tablename__ = "incidentes"

    __table_args__ = (
        CheckConstraint(
            """
            tipo IN (
                'acceso-no-autorizado',
                'malware',
                'phishing',
                'vulnerabilidad',
                'fallo-disponibilidad'
            )
            """,
            name="ck_incidentes_tipo",
        ),
        CheckConstraint(
            "prioridad IN ('alta', 'media', 'baja')",
            name="ck_incidentes_prioridad",
        ),
        CheckConstraint(
            """
            estado IN (
                'Registrado',
                'En revisión',
                'En progreso',
                'Resuelto',
                'Cerrado'
            )
            """,
            name="ck_incidentes_estado",
        ),
        CheckConstraint(
            "char_length(descripcion) BETWEEN 30 AND 600",
            name="ck_incidentes_descripcion",
        ),
    )

    id: Mapped[int] = mapped_column(
        BigInteger,
        Identity(),
        primary_key=True,
    )

    tipo: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    fecha: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )

    prioridad: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    estado: Mapped[str] = mapped_column(
        String,
        nullable=False,
        default="Registrado",
        server_default="Registrado",
    )

    responsable: Mapped[str | None] = mapped_column(
        String(80),
        nullable=True,
    )

    descripcion: Mapped[str] = mapped_column(
        String(600),
        nullable=False,
    )

    # Usuario autenticado que creó el incidente.
    # Nullable para conservar los incidentes anteriores.
    creado_por: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("usuarios.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    evidencia: Mapped["Evidencia | None"] = relationship(
        "Evidencia",
        back_populates="incidente",
        cascade="all, delete-orphan",
        uselist=False,
    )