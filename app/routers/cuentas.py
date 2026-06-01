from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from collections import defaultdict
from datetime import datetime
from app.database import get_db
from app.models import Cuenta, Usuario, Transaccion, Categoria
from app.schemas import CuentaCreate, CuentaOut, CuentaUpdate, LimiteUpdate, NombreUpdate
from app.auth import get_current_user
from app.utils import resumen_rendimientos

router = APIRouter(prefix="/api/cuentas", tags=["cuentas"])


@router.get("/", response_model=list[CuentaOut])
def listar_cuentas(db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    return db.query(Cuenta).filter(Cuenta.usuario_id == user.id).all()


@router.get("/{cuenta_id}", response_model=CuentaOut)
def obtener_cuenta(cuenta_id: int, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    cuenta = db.query(Cuenta).filter(Cuenta.id == cuenta_id, Cuenta.usuario_id == user.id).first()
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    return cuenta


@router.post("/", response_model=CuentaOut)
def crear_cuenta(cuenta: CuentaCreate, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    nueva = Cuenta(**cuenta.model_dump(), usuario_id=user.id)
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


@router.patch("/{cuenta_id}/saldo", response_model=CuentaOut)
def actualizar_saldo(cuenta_id: int, datos: CuentaUpdate, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    cuenta = db.query(Cuenta).filter(Cuenta.id == cuenta_id, Cuenta.usuario_id == user.id).first()
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    cuenta.saldo = datos.saldo
    db.commit()
    db.refresh(cuenta)
    return cuenta


@router.get("/{cuenta_id}/estadisticas")
def estadisticas_cuenta(cuenta_id: int, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    cuenta = db.query(Cuenta).filter(Cuenta.id == cuenta_id, Cuenta.usuario_id == user.id).first()
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    txs = db.query(Transaccion).filter(Transaccion.cuenta_id == cuenta_id).all()

    if not txs:
        return {"total_txs": 0, "total_ingresos": 0, "total_gastos": 0,
                "prom_mensual_gasto": 0, "mes_mayor_gasto": None,
                "mes_mayor_gasto_monto": 0, "top_categoria": None,
                "top_categoria_monto": 0, "primera_tx": None}

    ingresos_txs = [t for t in txs if t.monto > 0]
    gastos_txs   = [t for t in txs if t.monto < 0]

    total_ingresos = sum(t.monto for t in ingresos_txs)
    total_gastos   = sum(abs(t.monto) for t in gastos_txs)

    por_mes = defaultdict(float)
    for t in gastos_txs:
        por_mes[(t.fecha.year, t.fecha.month)] += abs(t.monto)

    prom_mensual  = sum(por_mes.values()) / len(por_mes) if por_mes else 0
    max_mes_key   = max(por_mes, key=por_mes.get) if por_mes else None
    mes_mayor     = datetime(max_mes_key[0], max_mes_key[1], 1).strftime("%b %Y") if max_mes_key else None
    mes_mayor_monto = por_mes[max_mes_key] if max_mes_key else 0

    por_cat    = defaultdict(float)
    for t in gastos_txs:
        if t.categoria_id:
            por_cat[t.categoria_id] += abs(t.monto)

    cats       = {c.id: c.nombre for c in db.query(Categoria).filter(Categoria.usuario_id == user.id).all()}
    top_cat_id = max(por_cat, key=por_cat.get) if por_cat else None
    primera    = min(txs, key=lambda t: t.fecha).fecha

    return {
        "total_txs":             len(txs),
        "total_ingresos":        round(total_ingresos, 2),
        "total_gastos":          round(total_gastos, 2),
        "prom_mensual_gasto":    round(prom_mensual, 2),
        "mes_mayor_gasto":       mes_mayor,
        "mes_mayor_gasto_monto": round(mes_mayor_monto, 2),
        "top_categoria":         cats.get(top_cat_id) if top_cat_id else None,
        "top_categoria_monto":   round(por_cat.get(top_cat_id, 0), 2) if top_cat_id else 0,
        "primera_tx":            primera,
    }


@router.get("/{cuenta_id}/rendimientos")
def rendimientos_cuenta(cuenta_id: int, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    cuenta = db.query(Cuenta).filter(Cuenta.id == cuenta_id, Cuenta.usuario_id == user.id).first()
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    return resumen_rendimientos(cuenta.rendimientos)


@router.patch("/{cuenta_id}/limite", response_model=CuentaOut)
def actualizar_limite(cuenta_id: int, datos: LimiteUpdate, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    cuenta = db.query(Cuenta).filter(Cuenta.id == cuenta_id, Cuenta.usuario_id == user.id).first()
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    cuenta.limite = datos.limite
    db.commit()
    db.refresh(cuenta)
    return cuenta


class FechasTCUpdate(BaseModel):
    dia_corte: Optional[int] = None
    dia_pago:  Optional[int] = None

@router.patch("/{cuenta_id}/fechas-tc", response_model=CuentaOut)
def actualizar_fechas_tc(cuenta_id: int, datos: FechasTCUpdate, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    cuenta = db.query(Cuenta).filter(Cuenta.id == cuenta_id, Cuenta.usuario_id == user.id).first()
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    for dia, campo in [(datos.dia_corte, "dia_corte"), (datos.dia_pago, "dia_pago")]:
        if dia is not None and not (1 <= dia <= 30):
            raise HTTPException(status_code=422, detail=f"{campo} debe estar entre 1 y 30")
    cuenta.dia_corte = datos.dia_corte
    cuenta.dia_pago  = datos.dia_pago
    db.commit()
    db.refresh(cuenta)
    return cuenta


@router.patch("/{cuenta_id}/nombre", response_model=CuentaOut)
def actualizar_nombre(cuenta_id: int, datos: NombreUpdate, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    cuenta = db.query(Cuenta).filter(Cuenta.id == cuenta_id, Cuenta.usuario_id == user.id).first()
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    nombre = datos.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=422, detail="El nombre no puede estar vacío")
    cuenta.nombre = nombre
    db.commit()
    db.refresh(cuenta)
    return cuenta


@router.delete("/{cuenta_id}")
def eliminar_cuenta(cuenta_id: int, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    from app.models import (Transaccion, RendimientoDiario, Transferencia,
                            TransaccionRecurrente, HorarioRendimiento, RendimientoProgramado)

    cuenta = db.query(Cuenta).filter(Cuenta.id == cuenta_id, Cuenta.usuario_id == user.id).first()
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    db.query(Transaccion).filter(Transaccion.cuenta_id == cuenta_id).delete()
    db.query(RendimientoDiario).filter(RendimientoDiario.cuenta_id == cuenta_id).delete()
    db.query(Transferencia).filter(
        (Transferencia.cuenta_origen_id == cuenta_id) |
        (Transferencia.cuenta_destino_id == cuenta_id)
    ).delete()
    db.query(TransaccionRecurrente).filter(TransaccionRecurrente.cuenta_id == cuenta_id).delete()
    db.query(HorarioRendimiento).filter(HorarioRendimiento.cuenta_id == cuenta_id).delete()
    db.query(RendimientoProgramado).filter(RendimientoProgramado.cuenta_id == cuenta_id).delete()

    db.delete(cuenta)
    db.commit()
    return {"ok": True}
