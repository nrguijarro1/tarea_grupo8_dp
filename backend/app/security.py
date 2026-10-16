
import os
import hashlib
import hmac
import secrets

from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from dotenv import load_dotenv


# ==========================================
# CONFIGURACION DE SEGURIDAD
# ==========================================

BACKEND_DIR = Path(__file__).resolve().parents[1]

load_dotenv(BACKEND_DIR / ".env")

JWT_ALGORITHM = "HS256"
JWT_ISSUER = "plataforma-incidentes"
JWT_EXPIRATION_MINUTES = 30

# Configuracion del hash PBKDF2
HASH_ALGORITHM = "sha256"
HASH_ITERATIONS = 600_000
SALT_LENGTH = 16
HASH_LENGTH = 32


# ==========================================
# CLAVE SECRETA JWT
# ==========================================

def obtener_clave_jwt() -> str:
    """
    Obtiene la clave secreta JWT desde
    las variables de entorno.
    """

    clave = os.getenv("JWT_SECRET_KEY")

    if not clave or len(clave.encode("utf-8")) < 32:
        raise RuntimeError(
            "JWT_SECRET_KEY no esta configurada "
            "o es demasiado corta. "
            "Debe tener al menos 32 bytes."
        )

    return clave


# ==========================================
# GENERAR HASH DE CONTRASEÑA
# ==========================================

def generar_hash_password(password: str) -> str:
    """
    Genera un hash seguro de la contraseña
    utilizando PBKDF2-HMAC-SHA256.

    Cada contraseña utiliza un salt aleatorio.
    """

    if not isinstance(password, str) or not password:
        raise ValueError(
            "La contraseña no puede estar vacia."
        )

    salt = secrets.token_bytes(SALT_LENGTH)

    password_hash = hashlib.pbkdf2_hmac(
        HASH_ALGORITHM,
        password.encode("utf-8"),
        salt,
        HASH_ITERATIONS,
        dklen=HASH_LENGTH,
    )

    return (
        f"pbkdf2_sha256${HASH_ITERATIONS}"
        f"${salt.hex()}${password_hash.hex()}"
    )


# ==========================================
# VERIFICAR CONTRASEÑA
# ==========================================

def verificar_password(
    password: str,
    password_hash: str,
) -> bool:
    """
    Compara una contraseña con el hash
    almacenado en la base de datos.

    Devuelve True si coincide.
    Devuelve False si es incorrecta.
    """

    if not isinstance(password, str):
        return False

    if not isinstance(password_hash, str):
        return False

    try:
        partes = password_hash.split("$")

        if len(partes) != 4:
            return False

        algoritmo, iteraciones, salt_hex, hash_hex = partes

        if algoritmo != "pbkdf2_sha256":
            return False

        cantidad = int(iteraciones)

        if not 100_000 <= cantidad <= 2_000_000:
            return False

        salt = bytes.fromhex(salt_hex)
        hash_guardado = bytes.fromhex(hash_hex)

        if len(salt) != SALT_LENGTH:
            return False

        if len(hash_guardado) != HASH_LENGTH:
            return False

        hash_calculado = hashlib.pbkdf2_hmac(
            HASH_ALGORITHM,
            password.encode("utf-8"),
            salt,
            cantidad,
            dklen=HASH_LENGTH,
        )

        return hmac.compare_digest(
            hash_calculado,
            hash_guardado,
        )

    except (ValueError, TypeError, AttributeError):
        return False


# ==========================================
# CREAR TOKEN JWT
# ==========================================

def crear_token_acceso(usuario_id: int) -> str:
    """
    Genera un token JWT para un usuario
    que inicio sesion correctamente.

    El token expira en 30 minutos.
    """

    if not isinstance(usuario_id, int) or usuario_id <= 0:
        raise ValueError(
            "El ID del usuario no es valido."
        )

    ahora = datetime.now(timezone.utc)

    expiracion = ahora + timedelta(
        minutes=JWT_EXPIRATION_MINUTES
    )

    payload = {
        "sub": str(usuario_id),
        "iat": ahora,
        "exp": expiracion,
        "iss": JWT_ISSUER,
        "tipo": "access",
    }

    token = jwt.encode(
        payload,
        obtener_clave_jwt(),
        algorithm=JWT_ALGORITHM,
    )

    return token


# ==========================================
# VALIDAR TOKEN JWT
# ==========================================

def obtener_id_desde_token(token: str) -> int | None:
    """
    Verifica la firma, el emisor y la
    fecha de expiracion del token JWT.

    Retorna el ID del usuario si es valido.
    Retorna None si el token es invalido.
    """

    if not isinstance(token, str) or not token:
        return None

    try:
        payload = jwt.decode(
            token,
            obtener_clave_jwt(),
            algorithms=[JWT_ALGORITHM],
            issuer=JWT_ISSUER,
            options={
                "require": [
                    "sub",
                    "iat",
                    "exp",
                    "iss",
                ],
            },
        )

        if payload.get("tipo") != "access":
            return None

        usuario_id = int(payload["sub"])

        if not 0 < usuario_id <= 2**63 - 1:
            return None

        return usuario_id

    except (
        jwt.InvalidTokenError,
        ValueError,
        TypeError,
    ):
        return None
