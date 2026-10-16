"""Normalización de texto; las contraseñas nunca se normalizan."""

import re
import unicodedata


def limpiar_texto(valor: str, *, multilinea: bool = False) -> str:
    if not isinstance(valor, str):
        raise ValueError("Se esperaba un texto.")
    valor = unicodedata.normalize("NFC", valor).strip()
    permitidos = "\n\r\t" if multilinea else ""
    if any(unicodedata.category(caracter).startswith("C") and caracter not in permitidos
           for caracter in valor):
        raise ValueError("El texto contiene caracteres de control no permitidos.")
    return valor


def limpiar_email(valor: str) -> str:
    email = limpiar_texto(valor).lower()
    if len(email) > 254 or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise ValueError("Correo electrónico inválido.")
    return email
