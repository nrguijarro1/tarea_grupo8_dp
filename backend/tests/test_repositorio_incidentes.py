"""Regresión del sello de actualización sin conexión a la base real."""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.repositories.incidente_repository import IncidenteRepository


def test_actualizar_renueva_fecha_de_modificacion():
    anterior = datetime.now(timezone.utc) - timedelta(days=1)
    incidente = SimpleNamespace(id=7, estado="Registrado", updated_at=anterior)

    class SesionFalsa:
        def scalar(self, _consulta):
            return incidente

        def commit(self):
            pass

        def refresh(self, _incidente):
            pass

        def rollback(self):
            pass

    resultado = IncidenteRepository(SesionFalsa()).actualizar(7, {"estado": "Resuelto"})
    assert resultado.estado == "Resuelto"
    assert resultado.updated_at > anterior
