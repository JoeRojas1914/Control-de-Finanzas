from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models import MSI, Cuenta, Transaccion, TipoCuenta, Usuario
from app.auth import get_current_user

router = APIRouter(prefix="/api/msi", tags=["msi"])


class MSICreate(BaseModel):
    descripcion  : str
    total        : float
    meses        : int
    fecha_inicio : datetime
    cuenta_id    : int


class MSIUpdate(BaseModel):
    descripcion : Optional[str] = None
    meses       : Optional[int] = None


def _cuenta_ids(db: Session, user_id: int):
    return [r[0] for r in db.query(Cuenta.id).filter(Cuenta.usuario_id == user_id).all()]


def _pagos_completados(fecha_inicio: datetime, meses: int) -> int:
    ahora = datetime.now()
    diff  = (ahora.year - fecha_inicio.year) * 12 + (ahora.month - fecha_inicio.month)
    return min(max(diff, 0), meses)


def _fmt(m: MSI) -> dict:
    pagos = _pagos_completados(m.fecha_inicio, m.meses)
    return {
        "id":               m.id,
        "descripcion":      m.descripcion,
        "total":            m.total,
        "meses":            m.meses,
        "monto_mensual":    m.monto_mensual,
        "fecha_inicio":     m.fecha_inicio.isoformat(),
        "cuenta_id":        m.cuenta_id,
        "cuenta_nombre":    m.cuenta.nombre,
        "pagos_completados": pagos,
        "meses_restantes":  max(m.meses - pagos, 0),
    }


@router.get("/")
def listar_msi(db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    ids  = _cuenta_ids(db, user.id)
    rows = db.query(MSI).filter(MSI.cuenta_id.in_(ids)).order_by(MSI.fecha_inicio.desc()).all()
    return [_fmt(m) for m in rows]


@router.post("/")
def crear_msi(datos: MSICreate, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    ids    = _cuenta_ids(db, user.id)
    cuenta = db.query(Cuenta).filter(Cuenta.id == datos.cuenta_id, Cuenta.id.in_(ids)).first()
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    if cuenta.tipo != TipoCuenta.credito:
        raise HTTPException(status_code=400, detail="MSI solo aplica a tarjetas de crédito")
    if datos.meses <= 0:
        raise HTTPException(status_code=400, detail="El número de meses debe ser mayor a cero")
    if datos.total <= 0:
        raise HTTPException(status_code=400, detail="El total debe ser mayor a cero")

    monto_mensual = round(datos.total / datos.meses, 2)

    tx = Transaccion(
        descripcion = f"MSI: {datos.descripcion}",
        monto       = -datos.total,
        fecha       = datos.fecha_inicio,
        cuenta_id   = datos.cuenta_id,
    )
    db.add(tx)
    cuenta.saldo -= datos.total
    db.flush()

    m = MSI(
        descripcion    = datos.descripcion,
        total          = datos.total,
        meses          = datos.meses,
        monto_mensual  = monto_mensual,
        fecha_inicio   = datos.fecha_inicio,
        cuenta_id      = datos.cuenta_id,
        transaccion_id = tx.id,
        usuario_id     = user.id,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return _fmt(m)


@router.patch("/{mid}")
def actualizar_msi(mid: int, datos: MSIUpdate, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    ids = _cuenta_ids(db, user.id)
    m   = db.query(MSI).filter(MSI.id == mid, MSI.cuenta_id.in_(ids)).first()
    if not m:
        raise HTTPException(status_code=404, detail="MSI no encontrado")
    if datos.descripcion is not None:
        m.descripcion = datos.descripcion
    if datos.meses is not None and datos.meses > 0:
        m.meses        = datos.meses
        m.monto_mensual = round(m.total / datos.meses, 2)
    db.commit()
    db.refresh(m)
    return _fmt(m)


@router.delete("/{mid}")
def eliminar_msi(mid: int, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    ids = _cuenta_ids(db, user.id)
    m   = db.query(MSI).filter(MSI.id == mid, MSI.cuenta_id.in_(ids)).first()
    if not m:
        raise HTTPException(status_code=404, detail="MSI no encontrado")

    if m.transaccion_id:
        tx = db.query(Transaccion).filter(Transaccion.id == m.transaccion_id).first()
        if tx:
            cuenta = db.query(Cuenta).filter(Cuenta.id == m.cuenta_id).first()
            if cuenta:
                cuenta.saldo -= tx.monto  # tx.monto is negative → -= negative = +
            db.delete(tx)

    db.delete(m)
    db.commit()
    return {"ok": True}
