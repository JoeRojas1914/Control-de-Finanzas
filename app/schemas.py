from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models import TipoCuenta

class CuentaBase(BaseModel):
    nombre  : str
    tipo    : TipoCuenta
    saldo   : float
    limite  : Optional[float] = None

class CuentaCreate(CuentaBase):
    pass

class CuentaUpdate(BaseModel):
    saldo: float

class CuentaOut(CuentaBase):
    id        : int
    creada_en : datetime

    class Config:
        from_attributes = True

class RendimientoCreate(BaseModel):
    cuenta_id : int
    monto     : float
    fecha     : Optional[datetime] = None

class RendimientoOut(RendimientoCreate):
    id    : int
    fecha : datetime

    class Config:
        from_attributes = True

class CategoriaOut(BaseModel):
    id     : int
    nombre : str

    class Config:
        from_attributes = True

class CategoriaCreate(BaseModel):
    nombre: str

class TransaccionCreate(BaseModel):
    descripcion  : str
    monto        : float
    cuenta_id    : int
    categoria_id : Optional[int] = None
    fecha        : Optional[datetime] = None

class TransaccionOut(TransaccionCreate):
    id       : int
    fecha    : datetime
    cuenta   : CuentaOut
    categoria: Optional[CategoriaOut] = None

    class Config:
        from_attributes = True

class LimiteUpdate(BaseModel):
    limite: float

class NombreUpdate(BaseModel):
    nombre: str

class RecurrenteCreate(BaseModel):
    descripcion   : str
    monto         : float
    frecuencia    : str
    proxima_fecha : datetime
    cuenta_id     : int
    categoria_id  : Optional[int] = None

class RecurrenteOut(RecurrenteCreate):
    id        : int
    activa    : bool
    creada_en : datetime
    cuenta    : CuentaOut
    categoria : Optional[CategoriaOut] = None

    class Config:
        from_attributes = True

class RendProgramadoCreate(BaseModel):
    cuenta_id     : int
    monto         : float
    frecuencia    : str
    proxima_fecha : datetime

class RendProgramadoOut(RendProgramadoCreate):
    id        : int
    activo    : bool
    creado_en : datetime
    cuenta    : CuentaOut

    class Config:
        from_attributes = True