from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
from app.database import get_db
from app.models import RendimientoDiario, Cuenta
from app.schemas import RendimientoCreate, RendimientoOut

router = APIRouter(prefix="/api/rendimientos", tags=["rendimientos"])

@router.get("/")
def listar_rendimientos(limite: int = 30, cuenta_id: int = None, db: Session = Depends(get_db)):
    q = (
        db.query(RendimientoDiario)
        .options(joinedload(RendimientoDiario.cuenta))
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
def registrar_rendimiento(datos: RendimientoCreate, db: Session = Depends(get_db)):
    cuenta = db.query(Cuenta).filter(Cuenta.id == datos.cuenta_id).first()
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    rendimiento = RendimientoDiario(
        cuenta_id = datos.cuenta_id,
        monto     = datos.monto,
        fecha     = datos.fecha or datetime.now()
    )
    db.add(rendimiento)
    cuenta.saldo += datos.monto
    db.commit()
    db.refresh(rendimiento)
    return rendimiento

@router.patch("/{rendimiento_id}")
def editar_rendimiento(rendimiento_id: int, datos: RendimientoCreate, db: Session = Depends(get_db)):
    rend = db.query(RendimientoDiario).filter(RendimientoDiario.id == rendimiento_id).first()
    if not rend:
        raise HTTPException(status_code=404, detail="Rendimiento no encontrado")

    cuenta_vieja = db.query(Cuenta).filter(Cuenta.id == rend.cuenta_id).first()
    if cuenta_vieja:
        cuenta_vieja.saldo -= rend.monto

    cuenta_nueva = db.query(Cuenta).filter(Cuenta.id == datos.cuenta_id).first()
    if not cuenta_nueva:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    cuenta_nueva.saldo += datos.monto

    rend.cuenta_id = datos.cuenta_id
    rend.monto     = datos.monto
    if datos.fecha:
        rend.fecha = datos.fecha

    db.commit()
    db.refresh(rend)
    return {"ok": True}

@router.delete("/{rendimiento_id}")
def eliminar_rendimiento(rendimiento_id: int, db: Session = Depends(get_db)):
    rend = db.query(RendimientoDiario).filter(RendimientoDiario.id == rendimiento_id).first()
    if not rend:
        raise HTTPException(status_code=404, detail="Rendimiento no encontrado")

    cuenta = db.query(Cuenta).filter(Cuenta.id == rend.cuenta_id).first()
    if cuenta:
        cuenta.saldo -= rend.monto

    db.delete(rend)
    db.commit()
    return {"ok": True}
