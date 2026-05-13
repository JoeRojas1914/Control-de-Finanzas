from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import enum

class TipoCuenta(str, enum.Enum):
    debito  = "debito"
    credito = "credito"

class Cuenta(Base):
    __tablename__ = "cuentas"

    id        = Column(Integer, primary_key=True, index=True)
    nombre    = Column(String, nullable=False)
    tipo      = Column(Enum(TipoCuenta), nullable=False)
    saldo     = Column(Float, default=0.0)
    limite    = Column(Float, nullable=True)
    creada_en = Column(DateTime, default=datetime.utcnow)

    rendimientos  = relationship("RendimientoDiario", back_populates="cuenta")
    transacciones = relationship("Transaccion",       back_populates="cuenta")

class RendimientoDiario(Base):
    __tablename__ = "rendimientos_diarios"

    id        = Column(Integer, primary_key=True, index=True)
    cuenta_id = Column(Integer, ForeignKey("cuentas.id"))
    monto     = Column(Float, nullable=False)
    fecha     = Column(DateTime, default=datetime.utcnow)

    cuenta = relationship("Cuenta", back_populates="rendimientos")

class Categoria(Base):
    __tablename__ = "categorias"

    id     = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, unique=True, nullable=False)

    transacciones = relationship("Transaccion", back_populates="categoria")

class Transaccion(Base):
    __tablename__ = "transacciones"

    id           = Column(Integer, primary_key=True, index=True)
    descripcion  = Column(String, nullable=False)
    monto        = Column(Float, nullable=False)
    fecha        = Column(DateTime, default=datetime.utcnow)
    cuenta_id    = Column(Integer, ForeignKey("cuentas.id"))
    categoria_id = Column(Integer, ForeignKey("categorias.id"), nullable=True)

    cuenta    = relationship("Cuenta",    back_populates="transacciones")
    categoria = relationship("Categoria", back_populates="transacciones")