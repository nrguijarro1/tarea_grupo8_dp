"""Mide GET de incidentes con sesión PostgreSQL de solo lectura.

Ejecutar desde la raíz: .venv/Scripts/python.exe backend/benchmark_semana7.py
No imprime respuestas, usuarios ni tokens.
"""

import time

from fastapi.testclient import TestClient
from sqlalchemy import event, text
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.main import app
from app.security import crear_token_acceso


def sesion_lectura():
    with Session(engine) as db:
        db.execute(text("SET TRANSACTION READ ONLY"))
        yield db


def main():
    with engine.connect() as conexion:
        conexion.execute(text("SET TRANSACTION READ ONLY"))
        usuario_id = conexion.execute(text(
            "SELECT id FROM usuarios WHERE activo = true ORDER BY id LIMIT 1"
        )).scalar_one_or_none()
    if usuario_id is None:
        raise RuntimeError("No hay usuario activo para medir GET de forma autorizada.")

    app.dependency_overrides[get_db] = sesion_lectura
    consultas = []

    def contar(_conexion, _cursor, statement, _parametros, _contexto, _ejecutar):
        if statement.lstrip().upper().startswith("SELECT"):
            consultas.append(statement)

    event.listen(engine, "before_cursor_execute", contar)
    try:
        with TestClient(app) as client:
            for numero in range(1, 4):
                consultas.clear()
                inicio = time.perf_counter()
                response = client.get(
                    "/api/incidentes",
                    headers={"Authorization": f"Bearer {crear_token_acceso(usuario_id)}"},
                )
                milisegundos = (time.perf_counter() - inicio) * 1000
                print(
                    f"ejecución={numero} estado={response.status_code} "
                    f"tiempo_ms={milisegundos:.2f} bytes={len(response.content)} "
                    f"selects={len(consultas)}"
                )
                response.raise_for_status()
    finally:
        event.remove(engine, "before_cursor_execute", contar)
        app.dependency_overrides.clear()


if __name__ == "__main__":
    main()
