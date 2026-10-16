"""Pruebas aisladas para la API: no escriben en Supabase.

Colocar en backend/tests/test_incidentes.py y ejecutar desde backend:
    python -m pytest -v tests/test_incidentes.py

Se sustituyen mediante dependency_overrides la conexión a BD y el servicio CRUD,
pero se utilizan las rutas reales, la validación Pydantic, JWT y los permisos.
"""

from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

import jwt
import pytest
from fastapi.testclient import TestClient

from app.database import get_db
from app.main import app
from app.routes.incidentes import get_service
from app.security import (
    JWT_ALGORITHM,
    JWT_ISSUER,
    crear_token_acceso,
    generar_hash_password,
    obtener_clave_jwt,
    verificar_password,
)


CLAVE_PRUEBAS = "clave-exclusiva-de-pruebas-automáticas-0123456789abcdef"
PASSWORD_PRUEBAS = "ClaveDePrueba123!"


def datos_incidente():
    return {
        "tipo": "malware",
        "fecha": date.today().isoformat(),
        "prioridad": "alta",
        "estado": "Registrado",
        "responsable": "Equipo SOC",
        "descripcion": "Incidente creado exclusivamente para pruebas automatizadas seguras.",
    }


class Resultado:
    def __init__(self, usuario):
        self.usuario = usuario

    def scalar_one_or_none(self):
        return self.usuario


class BDPruebas:
    """Suplanta las consultas de usuarios; nunca abre PostgreSQL."""

    def __init__(self):
        ahora = datetime.now(timezone.utc)
        self.usuarios = {
            1: SimpleNamespace(
                id=1, nombre="Test Admin", email="admin@example.com",
                password_hash=generar_hash_password(PASSWORD_PRUEBAS),
                rol="administrador", activo=True, created_at=ahora,
            ),
            2: SimpleNamespace(
                id=2, nombre="Test Analista", email="analista@example.com",
                password_hash=generar_hash_password(PASSWORD_PRUEBAS),
                rol="analista", activo=True, created_at=ahora,
            ),
            3: SimpleNamespace(
                id=3, nombre="Test Lector", email="lector@example.com",
                password_hash=generar_hash_password(PASSWORD_PRUEBAS),
                rol="lector", activo=True, created_at=ahora,
            ),
        }

    def get(self, modelo, usuario_id):
        return self.usuarios.get(usuario_id)

    def _usuario_por_consulta(self, consulta):
        # Lee los valores enlazados de SQLAlchemy sin ejecutarlos.
        parametros = consulta.compile().params
        email = next(
            (str(v).lower() for v in parametros.values()
             if isinstance(v, str) and "@" in v),
            None,
        )
        return next(
            (u for u in self.usuarios.values() if u.email == email),
            None,
        )

    def execute(self, consulta):
        return Resultado(self._usuario_por_consulta(consulta))

    def scalar(self, consulta):
        return self._usuario_por_consulta(consulta)

    def add(self, usuario):
        usuario.id = max(self.usuarios) + 1
        usuario.created_at = datetime.now(timezone.utc)
        self.usuarios[usuario.id] = usuario

    def commit(self):
        pass

    def refresh(self, usuario):
        pass

    def rollback(self):
        pass

    def scalars(self, consulta):
        class ListaUsuarios:
            def __init__(self, usuarios):
                self.usuarios = usuarios
            def all(self):
                return list(self.usuarios.values())
        return ListaUsuarios(self.usuarios)


class ServicioIncidentesPruebas:
    """Simula CRUD en memoria; no inserta ni borra registros reales."""

    def __init__(self):
        self.registros = {}
        self.siguiente_id = 1

    def registrar(self, datos, usuario_id=None):
        incidente = datos.model_dump(mode="json")
        incidente["id"] = self.siguiente_id
        incidente["creado_por"] = usuario_id
        self.registros[self.siguiente_id] = incidente
        self.siguiente_id += 1
        return dict(incidente)

    def listar(self, estado=None, prioridad=None):
        return [
            dict(i) for i in self.registros.values()
            if (estado is None or i["estado"] == estado)
            and (prioridad is None or i["prioridad"] == prioridad)
        ]

    def buscar_por_id(self, incidente_id):
        if incidente_id not in self.registros:
            raise LookupError("Incidente no encontrado.")
        return dict(self.registros[incidente_id])

    def reemplazar(self, incidente_id, datos):
        previo = self.buscar_por_id(incidente_id)
        nuevo = {**previo, **datos.model_dump(mode="json")}
        self.registros[incidente_id] = nuevo
        return dict(nuevo)

    def actualizar_parcialmente(self, incidente_id, datos):
        previo = self.buscar_por_id(incidente_id)
        nuevo = {**previo, **datos.model_dump(exclude_unset=True, mode="json")}
        self.registros[incidente_id] = nuevo
        return dict(nuevo)

    def eliminar(self, incidente_id):
        self.buscar_por_id(incidente_id)
        del self.registros[incidente_id]


@pytest.fixture
def entorno(monkeypatch):
    # No modifica el .env ni usa las credenciales reales de Supabase.
    monkeypatch.setenv("JWT_SECRET_KEY", CLAVE_PRUEBAS)
    bd = BDPruebas()
    servicio = ServicioIncidentesPruebas()
    app.dependency_overrides[get_db] = lambda: bd
    app.dependency_overrides[get_service] = lambda: servicio
    try:
        with TestClient(app) as client:
            yield SimpleNamespace(client=client, bd=bd, servicio=servicio)
    finally:
        app.dependency_overrides.clear()


def auth(usuario_id):
    return {"Authorization": f"Bearer {crear_token_acceso(usuario_id)}"}


def crear_prueba(entorno, usuario_id=1):
    response = entorno.client.post(
        "/api/incidentes", json=datos_incidente(), headers=auth(usuario_id)
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_salud(entorno):
    r = entorno.client.get("/api/salud")
    assert r.status_code == 200
    assert r.json()["estado"] == "ok"


def test_hash_password():
    hash_seguro = generar_hash_password(PASSWORD_PRUEBAS)
    assert PASSWORD_PRUEBAS not in hash_seguro
    assert verificar_password(PASSWORD_PRUEBAS, hash_seguro)
    assert not verificar_password("ClaveEquivocada", hash_seguro)


def test_login_correcto(entorno):
    r = entorno.client.post("/api/auth/login", json={
        "email": "admin@example.com", "password": PASSWORD_PRUEBAS
    })
    assert r.status_code == 200, r.text
    assert r.json()["access_token"]
    assert r.json()["rol"] == "administrador"


def test_login_incorrecto(entorno):
    r = entorno.client.post("/api/auth/login", json={
        "email": "admin@example.com", "password": "incorrecta"
    })
    assert r.status_code == 401


def test_acceso_sin_token(entorno):
    assert entorno.client.get("/api/incidentes").status_code == 401


def test_token_invalido(entorno):
    r = entorno.client.get(
        "/api/incidentes", headers={"Authorization": "Bearer token.invalido"}
    )
    assert r.status_code == 401


def test_token_expirado(entorno):
    ahora = datetime.now(timezone.utc)
    expirado = jwt.encode(
        {
            "sub": "1", "iat": ahora - timedelta(hours=2),
            "exp": ahora - timedelta(hours=1),
            "iss": JWT_ISSUER, "tipo": "access",
        },
        obtener_clave_jwt(), algorithm=JWT_ALGORITHM,
    )
    r = entorno.client.get(
        "/api/incidentes", headers={"Authorization": f"Bearer {expirado}"}
    )
    assert r.status_code == 401


def test_crear_incidente(entorno):
    incidente = crear_prueba(entorno)
    assert incidente["tipo"] == "malware"
    assert incidente["prioridad"] == "alta"
    assert incidente["estado"] == "Registrado"


def test_creado_por_desde_jwt(entorno):
    incidente = crear_prueba(entorno, usuario_id=2)
    assert incidente["creado_por"] == 2


def test_listar_incidentes(entorno):
    incidente = crear_prueba(entorno)
    r = entorno.client.get("/api/incidentes", headers=auth(3))
    assert r.status_code == 200
    assert incidente["id"] in [i["id"] for i in r.json()]


def test_buscar_incidente_por_id(entorno):
    incidente = crear_prueba(entorno)
    r = entorno.client.get(f"/api/incidentes/{incidente['id']}", headers=auth(3))
    assert r.status_code == 200
    assert r.json()["id"] == incidente["id"]


def test_actualizar_incidente(entorno):
    incidente = crear_prueba(entorno)
    r = entorno.client.patch(
        f"/api/incidentes/{incidente['id']}",
        json={"estado": "En progreso"}, headers=auth(2)
    )
    assert r.status_code == 200
    assert r.json()["estado"] == "En progreso"


def test_reemplazar_incidente(entorno):
    incidente = crear_prueba(entorno)
    datos = datos_incidente()
    datos["prioridad"] = "media"
    r = entorno.client.put(
        f"/api/incidentes/{incidente['id']}", json=datos, headers=auth(1)
    )
    assert r.status_code == 200
    assert r.json()["prioridad"] == "media"


def test_filtro_prioridad(entorno):
    crear_prueba(entorno)
    r = entorno.client.get("/api/incidentes", params={"prioridad": "alta"}, headers=auth(3))
    assert r.status_code == 200
    assert all(i["prioridad"] == "alta" for i in r.json())


def test_filtro_estado(entorno):
    crear_prueba(entorno)
    r = entorno.client.get("/api/incidentes", params={"estado": "Registrado"}, headers=auth(3))
    assert r.status_code == 200
    assert all(i["estado"] == "Registrado" for i in r.json())


def test_incidente_inexistente(entorno):
    r = entorno.client.get("/api/incidentes/999999999", headers=auth(1))
    assert r.status_code == 404


def test_prioridad_invalida(entorno):
    datos = datos_incidente()
    datos["prioridad"] = "urgente"
    r = entorno.client.post("/api/incidentes", json=datos, headers=auth(1))
    assert r.status_code == 400


def test_fecha_futura(entorno):
    datos = datos_incidente()
    datos["fecha"] = "2999-01-01"
    r = entorno.client.post("/api/incidentes", json=datos, headers=auth(1))
    assert r.status_code == 400


def test_descripcion_corta(entorno):
    datos = datos_incidente()
    datos["descripcion"] = "Muy corta"
    r = entorno.client.post("/api/incidentes", json=datos, headers=auth(1))
    assert r.status_code == 400


def test_eliminar_incidente(entorno):
    incidente = crear_prueba(entorno)
    r = entorno.client.delete(f"/api/incidentes/{incidente['id']}", headers=auth(1))
    assert r.status_code == 204
    assert entorno.client.get(
        f"/api/incidentes/{incidente['id']}", headers=auth(1)
    ).status_code == 404


def test_lector_no_puede_crear(entorno):
    r = entorno.client.post(
        "/api/incidentes", json=datos_incidente(), headers=auth(3)
    )
    assert r.status_code == 403


def test_analista_no_puede_eliminar(entorno):
    incidente = crear_prueba(entorno)
    r = entorno.client.delete(
        f"/api/incidentes/{incidente['id']}", headers=auth(2)
    )
    assert r.status_code == 403


def test_lector_no_puede_actualizar(entorno):
    incidente = crear_prueba(entorno)
    r = entorno.client.patch(
        f"/api/incidentes/{incidente['id']}",
        json={"estado": "En progreso"}, headers=auth(3)
    )
    assert r.status_code == 403


def test_analista_puede_crear(entorno):
    assert crear_prueba(entorno, usuario_id=2)["tipo"] == "malware"


def test_perfil_sesion(entorno):
    r = entorno.client.get("/api/auth/me", headers=auth(2))
    assert r.status_code == 200
    assert r.json()["rol"] == "analista"


def test_solo_admin_puede_crear_usuarios(entorno):
    datos = {
        "nombre": "Nuevo usuario", "email": "nuevo@example.com",
        "password": "NuevaClave123!", "rol": "lector",
    }
    sin_token = entorno.client.post("/api/auth/usuarios", json=datos)
    assert sin_token.status_code == 401
    prohibido = entorno.client.post("/api/auth/usuarios", json=datos, headers=auth(2))
    assert prohibido.status_code == 403
    autorizado = entorno.client.post("/api/auth/usuarios", json=datos, headers=auth(1))
    assert autorizado.status_code == 201, autorizado.text
    assert autorizado.json()["email"] == "nuevo@example.com"
    assert "password_hash" not in autorizado.json()


def test_usuario_duplicado(entorno):
    r = entorno.client.post("/api/auth/usuarios", json={
        "nombre": "Admin duplicado", "email": "admin@example.com",
        "password": "NuevaClave123!", "rol": "lector",
    }, headers=auth(1))
    assert r.status_code == 409
