from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
from app.database import get_db
from app.models import RendimientoDiario, Cuenta, Usuario
from app.schemas import RendimientoCreate, RendimientoOut
from app.auth import get_current_user

router = APIRouter(prefix="/api/rendimientos", tags=["rendimientos"])


def _cuenta_ids(db: Session, user_id: int):
    return [r[0] for r in db.query(Cuenta.id).filter(Cuenta.usuario_id == user_id).all()]


@router.get("/")
def listar_rendimientos(limite: int = 30, cuenta_id: int = None, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    ids = _cuenta_ids(db, user.id)
    q = (
        db.query(RendimientoDiario)
        .options(joinedload(RendimientoDiario.cuenta))
        .filter(RendimientoDiario.cuenta_id.in_(ids))
        .order_by(RendimientoDiario.fecha.desc())
    )
    if cuenta_id is not None:
        q = q.filter(RendimientoDiario.cuenta_id == cuenta_id)
    rendimientos = q.limit(limite).all()
    return [
        {
            "id":            r.id,
            "cuenta_id":     r.cuenta_id,
            "cuenta_nombre": r.cuenta.nombre if r.cuenta else "—",
            "monto":         r.monto,
            "fecha":         r.fecha,
        }
        for r in rendimientos
    ]


@router.post("/", response_model=RendimientoOut)
def registrar_rendimiento(datos: RendimientoCreate, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    cuenta = db.query(Cuenta).filter(Cuenta.id == datos.cuenta_id, Cuenta.usuario_id == user.id).first()
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    rendimiento = RendimientoDiario(
        cuenta_id=datos.cuenta_id,
        monto=datos.monto,
        fecha=datos.fecha or datetime.now(),
    )
    db.add(rendimiento)
    cuenta.saldo += datos.monto
    db.commit()
    db.refresh(rendimiento)
    return rendimiento


@router.patch("/{rendimiento_id}")
def editar_rendimiento(rendimiento_id: int, datos: RendimientoCreate, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    ids = _cuenta_ids(db, user.id)
    rend = db.query(RendimientoDiario).filter(
        RendimientoDiario.id == rendimiento_id,
        RendimientoDiario.cuenta_id.in_(ids)
    ).first()
    if not rend:
        raise HTTPException(status_code=404, detail="Rendimiento no encontrado")

    cuenta_vieja = db.query(Cuenta).filter(Cuenta.id == rend.cuenta_id).first()
    if cuenta_vieja:
        cuenta_vieja.saldo -= rend.monto

    cuenta_nueva = db.query(Cuenta).filter(Cuenta.id == datos.cuenta_id, Cuenta.usuario_id == user.id).first()
    if not cuenta_nueva:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    cuenta_nueva.saldo += datos.monto

    rend.cuenta_id = datos.cuenta_id
    rend.monto     = datos.monto
    if datos.fecha:
        rend.fecha = datos.fecha

    db.commit()
    return {"ok": True}


@router.delete("/{rendimiento_id}")
def eliminar_rendimiento(rendimiento_id: int, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    ids = _cuenta_ids(db, user.id)
    rend = db.query(RendimientoDiario).filter(
        RendimientoDiario.id == rendimiento_id,
        RendimientoDiario.cuenta_id.in_(ids)
    ).first()
    if not rend:
        raise HTTPException(status_code=404, detail="Rendimiento no encontrado")

    cuenta = db.query(Cuenta).filter(Cuenta.id == rend.cuenta_id).first()
    if cuenta:
        cuenta.saldo -= rend.monto

    db.delete(rend)
    db.commit()
    return {"ok": True}
