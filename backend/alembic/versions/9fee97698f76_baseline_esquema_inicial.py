"""baseline esquema inicial

Revision ID: 9fee97698f76
Revises:
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9fee97698f76"
down_revision: Union[str, Sequence[str], None] = None
branch_labels = None
depends_on = None


def upgrade() -> None:

    op.create_table(
        "incidentes",

        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(),
            primary_key=True,
        ),

        sa.Column(
            "tipo",
            sa.Text(),
            nullable=False,
        ),

        sa.Column(
            "fecha",
            sa.Date(),
            nullable=False,
        ),

        sa.Column(
            "prioridad",
            sa.Text(),
            nullable=False,
        ),

        sa.Column(
            "estado",
            sa.Text(),
            nullable=False,
            server_default="Registrado",
        ),

        sa.Column(
            "responsable",
            sa.String(length=80),
            nullable=True,
        ),

        sa.Column(
            "descripcion",
            sa.String(length=600),
            nullable=False,
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),

        sa.CheckConstraint(
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

        sa.CheckConstraint(
            "prioridad IN ('alta', 'media', 'baja')",
            name="ck_incidentes_prioridad",
        ),

        sa.CheckConstraint(
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

        sa.CheckConstraint(
            "char_length(descripcion) BETWEEN 30 AND 600",
            name="ck_incidentes_descripcion",
        ),
    )

    op.create_table(
        "evidencias",

        sa.Column(
            "id",
            sa.BigInteger(),
            sa.Identity(),
            primary_key=True,
        ),

        sa.Column(
            "incidente_id",
            sa.BigInteger(),
            nullable=False,
        ),

        sa.Column(
            "nombre_original",
            sa.String(length=200),
            nullable=False,
        ),

        sa.Column(
            "storage_path",
            sa.Text(),
            nullable=False,
            unique=True,
        ),

        sa.Column(
            "mime_type",
            sa.Text(),
            nullable=False,
        ),

        sa.Column(
            "tamano_bytes",
            sa.BigInteger(),
            nullable=False,
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),

        sa.ForeignKeyConstraint(
            ["incidente_id"],
            ["incidentes.id"],
            ondelete="CASCADE",
        ),

        sa.UniqueConstraint(
            "incidente_id"
        ),

        sa.CheckConstraint(
            """
            mime_type IN (
                'image/png',
                'image/jpeg',
                'application/pdf'
            )
            """,
            name="ck_evidencias_mime_type",
        ),

        sa.CheckConstraint(
            """
            tamano_bytes > 0
            AND tamano_bytes <= 5242880
            """,
            name="ck_evidencias_tamano",
        ),
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION
        public.actualizar_updated_at()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$;
        """
    )

    op.execute(
        """
        CREATE TRIGGER trigger_incidentes_updated_at
        BEFORE UPDATE ON public.incidentes
        FOR EACH ROW
        EXECUTE FUNCTION public.actualizar_updated_at();
        """
    )


def downgrade() -> None:

    op.execute(
        """
        DROP TRIGGER IF EXISTS
        trigger_incidentes_updated_at
        ON public.incidentes;
        """
    )

    op.execute(
        """
        DROP FUNCTION IF EXISTS
        public.actualizar_updated_at();
        """
    )

    op.drop_table("evidencias")
    op.drop_table("incidentes")