

from datetime import datetime

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Response,
    status,
)

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)

from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from typing import Literal

from app.database import get_db
from app.models.usuario import Usuario
from app.validation import limpiar_email, limpiar_texto

from app.dependencies import (
    obtener_usuario_actual,
    exigir_roles,
)

from app.security import (
    verificar_password,
    generar_hash_password,
    crear_token_acceso,
    JWT_EXPIRATION_MINUTES,
)


router = APIRouter(
    prefix="/api/auth",
    tags=["Autenticacion"],
)

RolUsuario = Literal[
    "administrador",
    "analista",
    "lector",
]

# VALIDACIONES

# Mantener el trabajo de hash incluso cuando el correo no exista.
HASH_USUARIO_INEXISTENTE = generar_hash_password("usuario-inexistente-no-autenticable")


class LoginRequest(BaseModel):

    model_config = ConfigDict(extra="forbid")

    email: str = Field(
        min_length=3,
        max_length=254,
    )

    password: str = Field(
        min_length=1,
        max_length=1024,
    )

    @field_validator("email", mode="before")
    @classmethod
    def validar_email(cls, value: str) -> str:
        return limpiar_email(value)


class LoginResponse(BaseModel):

    access_token: str
    token_type: str
    expires_in: int

    usuario_id: int
    nombre: str
    rol: RolUsuario


class UsuarioCrear(BaseModel):

    model_config = ConfigDict(extra="forbid")

    nombre: str = Field(
        min_length=2,
        max_length=120,
    )

    email: str = Field(
        min_length=3,
        max_length=254,
    )

    password: str = Field(
        min_length=8,
        max_length=1024,
    )

    rol: RolUsuario = "lector"

    @field_validator("nombre", mode="before")
    @classmethod
    def validar_nombre(cls, value: str) -> str:

        nombre = limpiar_texto(value)

        if not 2 <= len(nombre) <= 120:
            raise ValueError(
                "El nombre debe tener entre "
                "2 y 120 caracteres."
            )

        if not nombre.isprintable():
            raise ValueError(
                "El nombre contiene caracteres invalidos."
            )

        return nombre

    @field_validator("email", mode="before")
    @classmethod
    def validar_email(cls, value: str) -> str:
        return limpiar_email(value)


class UsuarioRespuesta(BaseModel):

    model_config = ConfigDict(
        from_attributes=True
    )

    id: int
    nombre: str
    email: str
    rol: RolUsuario
    activo: bool
    created_at: datetime

# INICIAR SESION

@router.post(
    "/login",
    response_model=LoginResponse,
)
def iniciar_sesion(
    datos: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):

    consulta = select(Usuario).where(
        func.lower(Usuario.email) == datos.email
    )

    usuario = db.execute(
        consulta
    ).scalar_one_or_none()

    error_credenciales = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Correo o contraseña incorrectos.",
        headers={
            "WWW-Authenticate": "Bearer"
        },
    )

    password_valida = verificar_password(
        datos.password,
        usuario.password_hash if usuario else HASH_USUARIO_INEXISTENTE,
    )

    if usuario is None or not password_valida or not usuario.activo:
        raise error_credenciales

    token = crear_token_acceso(
        usuario.id
    )

    response.headers["Cache-Control"] = "no-store"

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        expires_in=JWT_EXPIRATION_MINUTES * 60,
        usuario_id=usuario.id,
        nombre=usuario.nombre,
        rol=usuario.rol,
    )

# OBTENER USUARIO AUTENTICADO

@router.get(
    "/me",
    response_model=UsuarioRespuesta,
)
def obtener_perfil(
    response: Response,
    usuario: Usuario = Depends(
        obtener_usuario_actual
    ),
):

    response.headers["Cache-Control"] = "no-store"

    return usuario

@router.post(
    "/usuarios",
    response_model=UsuarioRespuesta,
    status_code=status.HTTP_201_CREATED,
)
def crear_usuario(
    datos: UsuarioCrear,
    response: Response,
    db: Session = Depends(get_db),
    administrador: Usuario = Depends(
        exigir_roles("administrador")
    ),
):

    response.headers["Cache-Control"] = "no-store"

    # Comprobar correo duplicado
    existente = db.scalar(
        select(Usuario).where(
            func.lower(Usuario.email) == datos.email
        )
    )

    if existente:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El correo ya esta registrado.",
        )

    # Generar hash seguro
    hash_seguro = generar_hash_password(
        datos.password
    )

    # Crear usuario
    nuevo_usuario = Usuario(
        nombre=datos.nombre,
        email=datos.email,
        password_hash=hash_seguro,
        rol=datos.rol,
        activo=True,
    )

    try:
        db.add(nuevo_usuario)
        db.commit()
        db.refresh(nuevo_usuario)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "No se pudo registrar el usuario. "
                "Compruebe que el correo no este duplicado."
            ),
        )

    return nuevo_usuario


@router.get(
    "/usuarios",
    response_model=list[UsuarioRespuesta],
)
def listar_usuarios(
    response: Response,
    db: Session = Depends(get_db),
    administrador: Usuario = Depends(
        exigir_roles("administrador")
    ),
):

    response.headers["Cache-Control"] = "no-store"

    consulta = (
        select(Usuario)
        .order_by(Usuario.id.asc())
    )

    usuarios = db.scalars(
        consulta
    ).all()

    return usuarios
