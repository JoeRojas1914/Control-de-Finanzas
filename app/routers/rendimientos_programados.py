from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, time, timedelta
from calendar import monthrange
from typing import Optional
from app.database import get_db
from app.models import RendimientoProgramado, HorarioRendimiento, RendimientoDiario, Cuenta, Usuario
from app.schemas import RendProgramadoCreate, RendProgramadoOut
from app.auth import get_current_user

router = APIRouter(prefix="/api/rendimientos-programados", tags=["rendimientos-programados"])

_DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]


class HorarioCreate(BaseModel):
    cuenta_id : int
    lunes     : Optional[float] = None
    martes    : Optional[float] = None
    miercoles : Optional[float] = None
    jueves    : Optional[float] = None
    viernes   : Optional[float] = None
    sabado    : Optional[float] = None
    domingo   : Optional[float] = None


def _calcular_proxima(fecha: datetime, frecuencia: str) -> datetime:
    if frecuencia == "diaria":
        return fecha + timedelta(days=1)
    if frecuencia == "semanal":
        return fecha + timedelta(weeks=1)
    if frecuencia == "quincenal":
        return fecha + timedelta(days=15)
    if frecuencia == "mensual":
        mes = fecha.month % 12 + 1
        año = fecha.year + (1 if fecha.month == 12 else 0)
        dia = min(fecha.day, monthrange(año, mes)[1])
        return fecha.replace(year=año, month=mes, day=dia)
    if frecuencia == "anual":
        return fecha.replace(year=fecha.year + 1)
    return fecha


# ── Frecuencia fija ───────────────────────────────────────────

@router.get("/")
def listar(db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    items = (
        db.query(RendimientoProgramado)
        .options(joinedload(RendimientoProgramado.cuenta))
        .filter(RendimientoProgramado.usuario_id == user.id)
        .order_by(RendimientoProgramado.id)
        .all()
    )
    return [
        {
            "id":            r.id,
            "cuenta_id":     r.cuenta_id,
            "cuenta":        {"id": r.cuenta.id, "nombre": r.cuenta.nombre},
            "monto":         r.monto,
            "frecuencia":    r.frecuencia.value,
            "proxima_fecha": r.proxima_fecha,
            "activo":        r.activo,
            "creado_en":     r.creado_en,
        }
        for r in items
    ]


@router.post("/", response_model=RendProgramadoOut)
def crear(datos: RendProgramadoCreate, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    cuenta = db.query(Cuenta).filter(Cuenta.id == datos.cuenta_id, Cuenta.usuario_id == user.id).first()
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    rp = RendimientoProgramado(
        cuenta_id=datos.cuenta_id, monto=datos.monto,
        frecuencia=datos.frecuencia, proxima_fecha=datos.proxima_fecha,
        usuario_id=user.id,
    )
    db.add(rp)
    db.commit()
    db.refresh(rp)
    return rp


@router.patch("/{rp_id}")
def editar(rp_id: int, datos: RendProgramadoCreate, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    rp = db.query(RendimientoProgramado).filter(RendimientoProgramado.id == rp_id, RendimientoProgramado.usuario_id == user.id).first()
    if not rp:
        raise HTTPException(status_code=404, detail="No encontrado")
    if not db.query(Cuenta).filter(Cuenta.id == datos.cuenta_id, Cuenta.usuario_id == user.id).first():
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    rp.cuenta_id = datos.cuenta_id
    rp.monto = datos.monto
    rp.frecuencia = datos.frecuencia
    rp.proxima_fecha = datos.proxima_fecha
    db.commit()
    return {"ok": True}


@router.patch("/{rp_id}/toggle")
def toggle(rp_id: int, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    rp = db.query(RendimientoProgramado).filter(RendimientoProgramado.id == rp_id, RendimientoProgramado.usuario_id == user.id).first()
    if not rp:
        raise HTTPException(status_code=404, detail="No encontrado")
    rp.activo = not rp.activo
    db.commit()
    return {"activo": rp.activo}


@router.delete("/{rp_id}")
def eliminar(rp_id: int, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    rp = db.query(RendimientoProgramado).filter(RendimientoProgramado.id == rp_id, RendimientoProgramado.usuario_id == user.id).first()
    if not rp:
        raise HTTPException(status_code=404, detail="No encontrado")
    db.delete(rp)
    db.commit()
    return {"ok": True}


# ── Horario semanal ───────────────────────────────────────────

@router.get("/horarios/")
def listar_horarios(db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    items = (
        db.query(HorarioRendimiento)
        .options(joinedload(HorarioRendimiento.cuenta))
        .filter(HorarioRendimiento.usuario_id == user.id)
        .order_by(HorarioRendimiento.id)
        .all()
    )
    return [
        {
            "id":                h.id,
            "cuenta_id":         h.cuenta_id,
            "cuenta":            {"id": h.cuenta.id, "nombre": h.cuenta.nombre},
            "lunes":             h.lunes, "martes": h.martes, "miercoles": h.miercoles,
            "jueves":            h.jueves, "viernes": h.viernes,
            "sabado":            h.sabado, "domingo": h.domingo,
            "ultima_aplicacion": h.ultima_aplicacion,
            "activo":            h.activo,
        }
        for h in items
    ]


@router.post("/horarios/")
def crear_horario(datos: HorarioCreate, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    if not db.query(Cuenta).filter(Cuenta.id == datos.cuenta_id, Cuenta.usuario_id == user.id).first():
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    h = HorarioRendimiento(**datos.model_dump(), usuario_id=user.id)
    db.add(h)
    db.commit()
    db.refresh(h)
    return {"id": h.id, "ok": True}


@router.patch("/horarios/{h_id}")
def editar_horario(h_id: int, datos: HorarioCreate, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    h = db.query(HorarioRendimiento).filter(HorarioRendimiento.id == h_id, HorarioRendimiento.usuario_id == user.id).first()
    if not h:
        raise HTTPException(status_code=404, detail="No encontrado")
    if not db.query(Cuenta).filter(Cuenta.id == datos.cuenta_id, Cuenta.usuario_id == user.id).first():
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    for campo, valor in datos.model_dump().items():
        setattr(h, campo, valor)
    db.commit()
    return {"ok": True}


@router.patch("/horarios/{h_id}/toggle")
def toggle_horario(h_id: int, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    h = db.query(HorarioRendimiento).filter(HorarioRendimiento.id == h_id, HorarioRendimiento.usuario_id == user.id).first()
    if not h:
        raise HTTPException(status_code=404, detail="No encontrado")
    h.activo = not h.activo
    db.commit()
    return {"activo": h.activo}


@router.delete("/horarios/{h_id}")
def eliminar_horario(h_id: int, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    h = db.query(HorarioRendimiento).filter(HorarioRendimiento.id == h_id, HorarioRendimiento.usuario_id == user.id).first()
    if not h:
        raise HTTPException(status_code=404, detail="No encontrado")
    db.delete(h)
    db.commit()
    return {"ok": True}


# ── Aplicar ambos tipos ───────────────────────────────────────

@router.post("/aplicar")
def aplicar(db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    hoy = datetime.now().date()
    aplicados = 0

    activos = db.query(RendimientoProgramado).filter(
        RendimientoProgramado.usuario_id == user.id,
        RendimientoProgramado.activo == True,
        RendimientoProgramado.proxima_fecha <= datetime.combine(hoy, time.max),
    ).all()
    for rp in activos:
        iteraciones = 0
        while rp.proxima_fecha.date() <= hoy and iteraciones < 730:
            rend = RendimientoDiario(cuenta_id=rp.cuenta_id, monto=rp.monto, fecha=rp.proxima_fecha)
            db.add(rend)
            cuenta = db.query(Cuenta).filter(Cuenta.id == rp.cuenta_id).first()
            if cuenta:
                cuenta.saldo += rp.monto
            rp.proxima_fecha = _calcular_proxima(rp.proxima_fecha, rp.frecuencia.value)
            aplicados += 1
            iteraciones += 1

    horarios = db.query(HorarioRendimiento).filter(
        HorarioRendimiento.usuario_id == user.id,
        HorarioRendimiento.activo == True,
    ).all()
    for h in horarios:
        ultima = h.ultima_aplicacion.date() if h.ultima_aplicacion else (hoy - timedelta(days=1))
        dia    = ultima + timedelta(days=1)
        cuenta = db.query(Cuenta).filter(Cuenta.id == h.cuenta_id).first()
        montos = [h.lunes, h.martes, h.miercoles, h.jueves, h.viernes, h.sabado, h.domingo]
        while dia <= hoy:
            monto = montos[dia.weekday()]
            if monto and monto > 0:
                db.add(RendimientoDiario(
                    cuenta_id=h.cuenta_id,
                    monto=monto,
                    fecha=datetime.combine(dia, time(12, 0)),
                ))
                if cuenta:
                    cuenta.saldo += monto
                aplicados += 1
            dia += timedelta(days=1)
        h.ultima_aplicacion = datetime.combine(hoy, time(12, 0))

    db.commit()
    return {"aplicados": aplicados}
