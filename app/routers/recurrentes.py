from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, time, timedelta
from calendar import monthrange
from app.database import get_db
from app.models import TransaccionRecurrente, Transaccion, Cuenta
from app.schemas import RecurrenteCreate, RecurrenteOut

router = APIRouter(prefix="/api/recurrentes", tags=["recurrentes"])


def calcular_proxima(fecha: datetime, frecuencia: str) -> datetime:
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


@router.get("/", response_model=list[RecurrenteOut])
def listar_recurrentes(db: Session = Depends(get_db)):
    return (
        db.query(TransaccionRecurrente)
        .options(joinedload(TransaccionRecurrente.cuenta),
                 joinedload(TransaccionRecurrente.categoria))
        .order_by(TransaccionRecurrente.proxima_fecha)
        .all()
    )


@router.post("/", response_model=RecurrenteOut)
def crear_recurrente(datos: RecurrenteCreate, db: Session = Depends(get_db)):
    cuenta = db.query(Cuenta).filter(Cuenta.id == datos.cuenta_id).first()
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    rec = TransaccionRecurrente(**datos.model_dump())
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return db.query(TransaccionRecurrente).options(
        joinedload(TransaccionRecurrente.cuenta),
        joinedload(TransaccionRecurrente.categoria)
    ).filter(TransaccionRecurrente.id == rec.id).first()


@router.patch("/{rec_id}", response_model=RecurrenteOut)
def editar_recurrente(rec_id: int, datos: RecurrenteCreate, db: Session = Depends(get_db)):
    rec = db.query(TransaccionRecurrente).filter(TransaccionRecurrente.id == rec_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recurrente no encontrada")
    for campo, valor in datos.model_dump().items():
        setattr(rec, campo, valor)
    db.commit()
    db.refresh(rec)
    return db.query(TransaccionRecurrente).options(
        joinedload(TransaccionRecurrente.cuenta),
        joinedload(TransaccionRecurrente.categoria)
    ).filter(TransaccionRecurrente.id == rec_id).first()


@router.patch("/{rec_id}/toggle")
def toggle_recurrente(rec_id: int, db: Session = Depends(get_db)):
    rec = db.query(TransaccionRecurrente).filter(TransaccionRecurrente.id == rec_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recurrente no encontrada")
    rec.activa = not rec.activa
    db.commit()
    return {"id": rec.id, "activa": rec.activa}


@router.delete("/{rec_id}")
def eliminar_recurrente(rec_id: int, db: Session = Depends(get_db)):
    rec = db.query(TransaccionRecurrente).filter(TransaccionRecurrente.id == rec_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recurrente no encontrada")
    db.delete(rec)
    db.commit()
    return {"ok": True}


@router.post("/aplicar")
def aplicar_recurrentes(db: Session = Depends(get_db)):
    hoy = datetime.now().date()
    limite = datetime.combine(hoy, time.max)

    activas = (
        db.query(TransaccionRecurrente)
        .filter(
            TransaccionRecurrente.activa == True,
            TransaccionRecurrente.proxima_fecha <= limite,
        )
        .all()
    )

    aplicadas = 0
    for rec in activas:
        iteraciones = 0
        while rec.proxima_fecha.date() <= hoy and iteraciones < 24:
            tx = Transaccion(
                descripcion  = rec.descripcion,
                monto        = rec.monto,
                cuenta_id    = rec.cuenta_id,
                categoria_id = rec.categoria_id,
                fecha        = rec.proxima_fecha,
            )
            db.add(tx)
            cuenta = db.query(Cuenta).filter(Cuenta.id == rec.cuenta_id).first()
            if cuenta:
                cuenta.saldo += rec.monto
            rec.proxima_fecha = calcular_proxima(rec.proxima_fecha, rec.frecuencia.value)
            aplicadas += 1
            iteraciones += 1

    db.commit()
    return {"aplicadas": aplicadas}
