
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.usuario import Usuario
from app.security import obtener_id_desde_token


# Esquema de autenticacion JWT
bearer_scheme = HTTPBearer(auto_error=False)


def obtener_usuario_actual(
    credenciales: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
    db: Session = Depends(get_db),
) -> Usuario:
    """
    Identifica al usuario autenticado a partir
    del token JWT enviado en la solicitud.
    """

    error_autenticacion = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token ausente, invalido o expirado.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credenciales is None:
        raise error_autenticacion

    usuario_id = obtener_id_desde_token(
        credenciales.credentials
    )

    if usuario_id is None:
        raise error_autenticacion

    usuario = db.get(Usuario, usuario_id)

    if usuario is None or not usuario.activo:
        raise error_autenticacion

    return usuario


def exigir_roles(*roles_permitidos: str):
    """
    Comprueba si el usuario tiene uno
    de los roles autorizados.
    """

    def comprobar_permisos(
        usuario: Usuario = Depends(obtener_usuario_actual),
    ) -> Usuario:

        if usuario.rol not in roles_permitidos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tiene permisos para esta operación.",
            )

        return usuario

    return comprobar_permisos
