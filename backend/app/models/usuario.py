
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Identity,
    Index,
    String,
    Text,
    func,
    text,
)

from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(
        BigInteger,
        Identity(always=True),
        primary_key=True,
    )

    nombre: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )

    email: Mapped[str] = mapped_column(
        String(254),
        nullable=False,
    )

    password_hash: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    rol: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="lector",
        server_default=text("'lector'"),
    )

    activo: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        CheckConstraint(
            "rol IN ('administrador', 'analista', 'lector')",
            name="usuarios_rol_check",
        ),
        CheckConstraint(
            "LENGTH(TRIM(nombre)) >= 2",
            name="usuarios_nombre_valido",
        ),
        CheckConstraint(
            "LENGTH(TRIM(email)) > 0",
            name="usuarios_email_no_vacio",
        ),
        Index(
            "usuarios_email_unico",
            func.lower(email),
            unique=True,
        ),
    )
