"""Usuarios con contraseñas hash y roles.

Revision ID: b712e20ac341
Revises: 9fee97698f76
"""

from alembic import op
import sqlalchemy as sa

revision = "b712e20ac341"
down_revision = "9fee97698f76"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "usuarios",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=True), primary_key=True),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("rol", sa.Text(), nullable=False, server_default="lector"),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("rol IN ('administrador', 'analista', 'lector')", name="usuarios_rol_check"),
        sa.CheckConstraint("LENGTH(TRIM(nombre)) >= 2", name="usuarios_nombre_valido"),
        sa.CheckConstraint("LENGTH(TRIM(email)) > 0", name="usuarios_email_no_vacio"),
    )
    op.create_index("usuarios_email_unico", "usuarios", [sa.text("lower(email)")], unique=True)


def downgrade() -> None:
    op.drop_index("usuarios_email_unico", table_name="usuarios")
    op.drop_table("usuarios")
