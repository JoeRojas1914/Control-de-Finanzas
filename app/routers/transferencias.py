from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models import Transferencia, Cuenta, Usuario
from app.auth import get_current_user

router = APIRouter(prefix="/api/transferencias", tags=["transferencias"])


class TransferenciaCreate(BaseModel):
    cuenta_origen_id  : int
    cuenta_destino_id : int
    monto             : float
    descripcion       : Optional[str] = None
    fecha             : Optional[datetime] = None


def _cuenta_ids(db: Session, user_id: int):
    return [r[0] for r in db.query(Cuenta.id).filter(Cuenta.usuario_id == user_id).all()]


def _load(db: Session, tid: int):
    return (
        db.query(Transferencia)
        .options(
            joinedload(Transferencia.cuenta_origen),
            joinedload(Transferencia.cuenta_destino),
        )
        .filter(Transferencia.id == tid)
        .first()
    )


@router.get("/")
def listar_transferencias(db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    ids = _cuenta_ids(db, user.id)
    rows = (
        db.query(Transferencia)
        .options(
            joinedload(Transferencia.cuenta_origen),
            joinedload(Transferencia.cuenta_destino),
        )
        .filter(Transferencia.cuenta_origen_id.in_(ids))
        .order_by(Transferencia.fecha.desc())
        .all()
    )
    return [
        {
            "id":                r.id,
            "monto":             r.monto,
            "descripcion":       r.descripcion,
            "fecha":             r.fecha.isoformat(),
            "cuenta_origen":     r.cuenta_origen.nombre  if r.cuenta_origen  else "—",
            "cuenta_origen_id":  r.cuenta_origen_id,
            "cuenta_destino":    r.cuenta_destino.nombre if r.cuenta_destino else "—",
            "cuenta_destino_id": r.cuenta_destino_id,
        }
        for r in rows
    ]


@router.post("/")
def crear_transferencia(datos: TransferenciaCreate, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    if datos.cuenta_origen_id == datos.cuenta_destino_id:
        raise HTTPException(status_code=400, detail="La cuenta origen y destino no pueden ser la misma")
    if datos.monto <= 0:
        raise HTTPException(status_code=400, detail="El monto debe ser mayor a cero")

    ids = _cuenta_ids(db, user.id)
    origen  = db.query(Cuenta).filter(Cuenta.id == datos.cuenta_origen_id,  Cuenta.id.in_(ids)).first()
    destino = db.query(Cuenta).filter(Cuenta.id == datos.cuenta_destino_id, Cuenta.id.in_(ids)).first()
    if not origen or not destino:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    t = Transferencia(
        cuenta_origen_id  = datos.cuenta_origen_id,
        cuenta_destino_id = datos.cuenta_destino_id,
        monto             = datos.monto,
        descripcion       = datos.descripcion,
        fecha             = datos.fecha or datetime.now(),
    )
    db.add(t)
    origen.saldo  -= datos.monto
    destino.saldo += datos.monto
    db.commit()
    db.refresh(t)
    t = _load(db, t.id)
    return {
        "id":                t.id,
        "monto":             t.monto,
        "descripcion":       t.descripcion,
        "fecha":             t.fecha.isoformat(),
        "cuenta_origen":     t.cuenta_origen.nombre,
        "cuenta_origen_id":  t.cuenta_origen_id,
        "cuenta_destino":    t.cuenta_destino.nombre,
        "cuenta_destino_id": t.cuenta_destino_id,
    }


@router.delete("/{tid}")
def eliminar_transferencia(tid: int, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    ids = _cuenta_ids(db, user.id)
    t = db.query(Transferencia).filter(
        Transferencia.id == tid,
        Transferencia.cuenta_origen_id.in_(ids)
    ).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transferencia no encontrada")

    origen  = db.query(Cuenta).filter(Cuenta.id == t.cuenta_origen_id).first()
    destino = db.query(Cuenta).filter(Cuenta.id == t.cuenta_destino_id).first()
    if origen:  origen.saldo  += t.monto
    if destino: destino.saldo -= t.monto

    db.delete(t)
    db.commit()
    return {"ok": True}
