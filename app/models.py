from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import enum


class Usuario(Base):
    __tablename__ = "usuarios"

    id               = Column(Integer, primary_key=True, index=True)
    username         = Column(String, unique=True, nullable=False, index=True)
    password_hash    = Column(String, nullable=False)
    nombre           = Column(String, nullable=True)
    apellido         = Column(String, nullable=True)
    correo           = Column(String, nullable=True)
    fecha_nacimiento = Column(DateTime, nullable=True)
    moneda           = Column(String, default="MXN")
    avatar_color     = Column(String, default="#6366f1")
    creado_en        = Column(DateTime, default=datetime.now)


class TipoCuenta(str, enum.Enum):
    debito  = "debito"
    credito = "credito"


class Cuenta(Base):
    __tablename__ = "cuentas"

    id          = Column(Integer, primary_key=True, index=True)
    nombre      = Column(String, nullable=False)
    tipo        = Column(Enum(TipoCuenta), nullable=False)
    saldo       = Column(Float, default=0.0)
    limite      = Column(Float, nullable=True)
    creada_en   = Column(DateTime, default=datetime.now)
    usuario_id  = Column(Integer, ForeignKey("usuarios.id"), nullable=True, index=True)

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

    id         = Column(Integer, primary_key=True, index=True)
    nombre     = Column(String, nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True, index=True)

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


class Transferencia(Base):
    __tablename__ = "transferencias"

    id                = Column(Integer, primary_key=True, index=True)
    cuenta_origen_id  = Column(Integer, ForeignKey("cuentas.id"))
    cuenta_destino_id = Column(Integer, ForeignKey("cuentas.id"))
    monto             = Column(Float, nullable=False)
    descripcion       = Column(String, nullable=True)
    fecha             = Column(DateTime, default=datetime.now)

    cuenta_origen  = relationship("Cuenta", foreign_keys=[cuenta_origen_id])
    cuenta_destino = relationship("Cuenta", foreign_keys=[cuenta_destino_id])


class Presupuesto(Base):
    __tablename__ = "presupuestos"

    id           = Column(Integer, primary_key=True, index=True)
    categoria_id = Column(Integer, ForeignKey("categorias.id"))
    monto_limite = Column(Float, nullable=False)
    creado_en    = Column(DateTime, default=datetime.now)
    usuario_id   = Column(Integer, ForeignKey("usuarios.id"), nullable=True, index=True)

    categoria = relationship("Categoria")


class FrecuenciaRecurrente(str, enum.Enum):
    diaria    = "diaria"
    semanal   = "semanal"
    quincenal = "quincenal"
    mensual   = "mensual"
    anual     = "anual"


class TransaccionRecurrente(Base):
    __tablename__ = "transacciones_recurrentes"

    id            = Column(Integer, primary_key=True, index=True)
    descripcion   = Column(String, nullable=False)
    monto         = Column(Float, nullable=False)
    frecuencia    = Column(Enum(FrecuenciaRecurrente), nullable=False)
    proxima_fecha = Column(DateTime, nullable=False)
    activa        = Column(Boolean, default=True)
    creada_en     = Column(DateTime, default=datetime.now)
    cuenta_id     = Column(Integer, ForeignKey("cuentas.id"))
    categoria_id  = Column(Integer, ForeignKey("categorias.id"), nullable=True)
    usuario_id    = Column(Integer, ForeignKey("usuarios.id"), nullable=True, index=True)

    cuenta    = relationship("Cuenta")
    categoria = relationship("Categoria")


class HorarioRendimiento(Base):
    __tablename__ = "horarios_rendimiento"

    id                = Column(Integer, primary_key=True, index=True)
    cuenta_id         = Column(Integer, ForeignKey("cuentas.id"), nullable=False)
    lunes             = Column(Float, nullable=True)
    martes            = Column(Float, nullable=True)
    miercoles         = Column(Float, nullable=True)
    jueves            = Column(Float, nullable=True)
    viernes           = Column(Float, nullable=True)
    sabado            = Column(Float, nullable=True)
    domingo           = Column(Float, nullable=True)
    ultima_aplicacion = Column(DateTime, nullable=True)
    activo            = Column(Boolean, default=True)
    creado_en         = Column(DateTime, default=datetime.now)
    usuario_id        = Column(Integer, ForeignKey("usuarios.id"), nullable=True, index=True)

    cuenta = relationship("Cuenta")


class RendimientoProgramado(Base):
    __tablename__ = "rendimientos_programados"

    id            = Column(Integer, primary_key=True, index=True)
    cuenta_id     = Column(Integer, ForeignKey("cuentas.id"), nullable=False)
    monto         = Column(Float, nullable=False)
    frecuencia    = Column(Enum(FrecuenciaRecurrente), nullable=False)
    proxima_fecha = Column(DateTime, nullable=False)
    activo        = Column(Boolean, default=True)
    creado_en     = Column(DateTime, default=datetime.now)
    usuario_id    = Column(Integer, ForeignKey("usuarios.id"), nullable=True, index=True)

    cuenta = relationship("Cuenta")


class Meta(Base):
    __tablename__ = "metas"

    id             = Column(Integer, primary_key=True, index=True)
    nombre         = Column(String, nullable=False)
    emoji          = Column(String, nullable=True)
    monto_objetivo = Column(Float, nullable=False)
    monto_actual   = Column(Float, default=0.0)
    fecha_objetivo = Column(DateTime, nullable=True)
    creada_en      = Column(DateTime, default=datetime.now)
    usuario_id     = Column(Integer, ForeignKey("usuarios.id"), nullable=True, index=True)
