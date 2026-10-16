from datetime import date

from pydantic import BaseModel, ConfigDict, field_validator, model_validator
from app.validation import limpiar_texto


TIPOS = {
    "acceso-no-autorizado": "Acceso no autorizado",
    "malware": "Malware",
    "phishing": "Phishing",
    "vulnerabilidad": "Vulnerabilidad reportada",
    "fallo-disponibilidad": "Fallo de disponibilidad",
}

PRIORIDADES = {
    "alta",
    "media",
    "baja",
}

ESTADOS = {
    "Registrado",
    "En revisión",
    "En progreso",
    "Resuelto",
    "Cerrado",
}


def validar_tipo(valor: str) -> str:
    valor = limpiar_texto(valor)

    if valor not in TIPOS:
        raise ValueError(
            "Seleccione un tipo de incidente válido."
        )

    return valor


def validar_prioridad(valor: str) -> str:
    valor = limpiar_texto(valor).lower()

    if valor not in PRIORIDADES:
        raise ValueError(
            "Seleccione una prioridad válida."
        )

    return valor


def validar_estado(valor: str) -> str:
    valor = limpiar_texto(valor)

    if valor not in ESTADOS:
        raise ValueError(
            "Seleccione un estado válido."
        )

    return valor


def validar_fecha(valor: date) -> date:
    if valor > date.today():
        raise ValueError(
            "La fecha no puede estar en el futuro."
        )

    return valor


def validar_responsable(
    valor: str | None,
) -> str | None:
    if valor is None:
        return None

    valor = limpiar_texto(valor)

    if not valor or valor == "No especificado":
        return None

    if len(valor) < 3:
        raise ValueError(
            "El responsable debe tener al menos 3 caracteres."
        )

    if len(valor) > 80:
        raise ValueError(
            "El responsable no puede superar 80 caracteres."
        )

    return valor


def validar_descripcion(valor: str) -> str:
    valor = limpiar_texto(valor, multilinea=True)

    if len(valor) < 30 or len(valor) > 600:
        raise ValueError(
            "La descripción debe tener entre 30 y 600 caracteres."
        )

    return valor


class IncidenteCrear(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    tipo: str
    fecha: date
    prioridad: str
    estado: str = "Registrado"
    responsable: str | None = None
    descripcion: str

    @field_validator("tipo")
    @classmethod
    def validar_tipo_campo(cls, valor):
        return validar_tipo(valor)

    @field_validator("fecha")
    @classmethod
    def validar_fecha_campo(cls, valor):
        return validar_fecha(valor)

    @field_validator("prioridad")
    @classmethod
    def validar_prioridad_campo(cls, valor):
        return validar_prioridad(valor)

    @field_validator("estado")
    @classmethod
    def validar_estado_campo(cls, valor):
        return validar_estado(valor)

    @field_validator("responsable")
    @classmethod
    def validar_responsable_campo(cls, valor):
        return validar_responsable(valor)

    @field_validator("descripcion")
    @classmethod
    def validar_descripcion_campo(cls, valor):
        return validar_descripcion(valor)


class IncidenteReemplazo(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    tipo: str
    fecha: date
    prioridad: str
    estado: str
    responsable: str | None = None
    descripcion: str

    @field_validator("tipo")
    @classmethod
    def validar_tipo_campo(cls, valor):
        return validar_tipo(valor)

    @field_validator("fecha")
    @classmethod
    def validar_fecha_campo(cls, valor):
        return validar_fecha(valor)

    @field_validator("prioridad")
    @classmethod
    def validar_prioridad_campo(cls, valor):
        return validar_prioridad(valor)

    @field_validator("estado")
    @classmethod
    def validar_estado_campo(cls, valor):
        return validar_estado(valor)

    @field_validator("responsable")
    @classmethod
    def validar_responsable_campo(cls, valor):
        return validar_responsable(valor)

    @field_validator("descripcion")
    @classmethod
    def validar_descripcion_campo(cls, valor):
        return validar_descripcion(valor)


class IncidenteParcial(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    tipo: str | None = None
    fecha: date | None = None
    prioridad: str | None = None
    estado: str | None = None
    responsable: str | None = None
    descripcion: str | None = None

    @field_validator("tipo")
    @classmethod
    def validar_tipo_campo(cls, valor):
        if valor is None:
            return valor

        return validar_tipo(valor)

    @field_validator("fecha")
    @classmethod
    def validar_fecha_campo(cls, valor):
        if valor is None:
            return valor

        return validar_fecha(valor)

    @field_validator("prioridad")
    @classmethod
    def validar_prioridad_campo(cls, valor):
        if valor is None:
            return valor

        return validar_prioridad(valor)

    @field_validator("estado")
    @classmethod
    def validar_estado_campo(cls, valor):
        if valor is None:
            return valor

        return validar_estado(valor)

    @field_validator("responsable")
    @classmethod
    def validar_responsable_campo(cls, valor):
        return validar_responsable(valor)

    @field_validator("descripcion")
    @classmethod
    def validar_descripcion_campo(cls, valor):
        if valor is None:
            return valor

        return validar_descripcion(valor)

    @model_validator(mode="after")
    def validar_campos(self):
        if not self.model_fields_set:
            raise ValueError(
                "Proporcione al menos un campo editable."
            )

        for campo in self.model_fields_set - {"responsable"}:
            if getattr(self, campo) is None:
                raise ValueError(f"El campo {campo} no puede ser nulo.")

        return self
