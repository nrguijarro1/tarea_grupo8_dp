
from getpass import getpass

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.database import SessionLocal
from app.models.usuario import Usuario
from app.security import generar_hash_password
from app.validation import limpiar_email, limpiar_texto


# ==========================================
# ROLES DISPONIBLES
# ==========================================

ROLES = {
    "1": "administrador",
    "2": "analista",
    "3": "lector",
}


# ==========================================
# SELECCIONAR ROL
# ==========================================

def seleccionar_rol():
    print("\n=== SELECCIONAR ROL ===")
    print("1. Administrador")
    print("2. Analista")
    print("3. Lector")

    opcion = input(
        "\nSeleccione una opcion (1-3): "
    ).strip()

    if opcion not in ROLES:
        print("Error: Rol no valido.")
        return None

    return ROLES[opcion]


# ==========================================
# CREAR USUARIO
# ==========================================

def crear_usuario():

    print("\n==============================")
    print("   REGISTRO DE USUARIOS")
    print("==============================")

    rol = seleccionar_rol()

    if rol is None:
        return

    print(f"\nRol seleccionado: {rol}")

    try:
        nombre = limpiar_texto(input("Nombre: "))
        email = limpiar_email(input("Correo: "))
    except ValueError as error:
        print(f"Error: {error}")
        return

    password = getpass(
        "Contraseña: "
    )

    confirmar = getpass(
        "Confirmar contraseña: "
    )

    # ======================================
    # VALIDACIONES
    # ======================================

    if not 2 <= len(nombre) <= 120:
        print(
            "Error: El nombre debe tener "
            "entre 2 y 120 caracteres."
        )
        return

    if not 8 <= len(password) <= 1024:
        print(
            "Error: La contraseña debe "
            "tener entre 8 y 1024 caracteres."
        )
        return

    if password != confirmar:
        print(
            "Error: Las contraseñas "
            "no coinciden."
        )
        return

    # ======================================
    # CONEXION CON SUPABASE
    # ======================================

    try:
        with SessionLocal() as db:

            existente = db.scalar(
                select(Usuario).where(
                    func.lower(Usuario.email) == email
                )
            )

            if existente:
                print(
                    "Error: El correo "
                    "ya esta registrado."
                )
                return

            # Generar hash de contraseña
            hash_seguro = generar_hash_password(
                password
            )

            # Crear usuario
            usuario = Usuario(
                nombre=nombre,
                email=email,
                password_hash=hash_seguro,
                rol=rol,
                activo=True,
            )

            db.add(usuario)
            db.commit()
            db.refresh(usuario)

            print("\n==============================")
            print(" USUARIO CREADO CORRECTAMENTE")
            print("==============================")
            print(f"ID: {usuario.id}")
            print(f"Nombre: {usuario.nombre}")
            print(f"Correo: {usuario.email}")
            print(f"Rol: {usuario.rol}")
            print(f"Activo: {usuario.activo}")

    except IntegrityError:
        print(
            "Error: El usuario no pudo "
            "registrarse. Compruebe que "
            "el correo no este duplicado."
        )

    except SQLAlchemyError:
        print(
            "Error: No se pudo completar "
            "la operacion en la base de datos."
        )


# ==========================================
# MENU PRINCIPAL
# ==========================================

def main():

    while True:

        crear_usuario()

        print("\n------------------------------")

        continuar = input(
            "¿Desea crear otro usuario? (s/n): "
        ).strip().lower()

        if continuar != "s":
            print(
                "\nRegistro de usuarios finalizado."
            )
            break


if __name__ == "__main__":
    main()
