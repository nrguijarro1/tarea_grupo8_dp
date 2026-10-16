from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Evidencia(Base):
    __tablename__ = "evidencias"

    __table_args__ = (
        CheckConstraint(
            """
            mime_type IN (
                'image/png',
                'image/jpeg',
                'application/pdf'
            )
            """,
            name="ck_evidencias_mime_type",
        ),
        CheckConstraint(
            "tamano_bytes > 0 AND tamano_bytes <= 5242880",
            name="ck_evidencias_tamano",
        ),
    )

    id: Mapped[int] = mapped_column(
        BigInteger,
        Identity(),
        primary_key=True,
    )

    incidente_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey(
            "incidentes.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        unique=True,
    )

    nombre_original: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    storage_path: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        unique=True,
    )

    mime_type: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    tamano_bytes: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    incidente: Mapped["Incidente"] = relationship(
        "Incidente",
        back_populates="evidencia",
    )