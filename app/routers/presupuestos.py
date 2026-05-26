from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import datetime
from app.database import get_db
from app.models import Presupuesto, Transaccion, Categoria, Cuenta, Usuario
from app.auth import get_current_user
from pydantic import BaseModel

router = APIRouter(prefix="/api/presupuestos", tags=["presupuestos"])


class PresupuestoCreate(BaseModel):
    categoria_id : int
    monto_limite : float


def _cuenta_ids(db: Session, user_id: int):
    return [r[0] for r in db.query(Cuenta.id).filter(Cuenta.usuario_id == user_id).all()]


def _gasto_mes(db: Session, categoria_id: int, cuenta_ids: list) -> float:
    inicio = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    total = db.query(func.sum(Transaccion.monto)).filter(
        Transaccion.categoria_id == categoria_id,
        Transaccion.cuenta_id.in_(cuenta_ids),
        Transaccion.monto < 0,
        Transaccion.fecha >= inicio,
    ).scalar() or 0
    return round(abs(total), 2)


def _build(p: Presupuesto, gastado: float) -> dict:
    pct = round(gastado / p.monto_limite * 100, 1) if p.monto_limite > 0 else 0
    return {
        "id":           p.id,
        "categoria_id": p.categoria_id,
        "categoria":    p.categoria.nombre,
        "monto_limite": p.monto_limite,
        "gastado":      gastado,
        "porcentaje":   pct,
    }


@router.get("/")
def listar_presupuestos(db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    ids = _cuenta_ids(db, user.id)
    presupuestos = (
        db.query(Presupuesto)
        .options(joinedload(Presupuesto.categoria))
        .filter(Presupuesto.usuario_id == user.id)
        .order_by(Presupuesto.categoria_id)
        .all()
    )
    return [_build(p, _gasto_mes(db, p.categoria_id, ids)) for p in presupuestos]


@router.post("/")
def crear_presupuesto(datos: PresupuestoCreate, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    cat = db.query(Categoria).filter(Categoria.id == datos.categoria_id, Categoria.usuario_id == user.id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    if db.query(Presupuesto).filter(Presupuesto.categoria_id == datos.categoria_id, Presupuesto.usuario_id == user.id).first():
        raise HTTPException(status_code=400, detail="Ya existe un presupuesto para esta categoría")
    p = Presupuesto(categoria_id=datos.categoria_id, monto_limite=datos.monto_limite, usuario_id=user.id)
    db.add(p)
    db.commit()
    db.refresh(p)
    p = db.query(Presupuesto).options(joinedload(Presupuesto.categoria)).filter(Presupuesto.id == p.id).first()
    ids = _cuenta_ids(db, user.id)
    return _build(p, _gasto_mes(db, p.categoria_id, ids))


@router.patch("/{pres_id}")
def editar_presupuesto(pres_id: int, datos: PresupuestoCreate, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    p = db.query(Presupuesto).filter(Presupuesto.id == pres_id, Presupuesto.usuario_id == user.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    p.monto_limite = datos.monto_limite
    p.categoria_id = datos.categoria_id
    db.commit()
    p = db.query(Presupuesto).options(joinedload(Presupuesto.categoria)).filter(Presupuesto.id == pres_id).first()
    ids = _cuenta_ids(db, user.id)
    return _build(p, _gasto_mes(db, p.categoria_id, ids))


@router.delete("/{pres_id}")
def eliminar_presupuesto(pres_id: int, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    p = db.query(Presupuesto).filter(Presupuesto.id == pres_id, Presupuesto.usuario_id == user.id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    db.delete(p)
    db.commit()
    return {"ok": True}
