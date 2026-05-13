from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import Transaccion, Cuenta
from app.schemas import TransaccionCreate, TransaccionOut

router = APIRouter(prefix="/api/transacciones", tags=["transacciones"])

@router.get("/", response_model=list[TransaccionOut])
def listar_transacciones(limite: int = 20, db: Session = Depends(get_db)):
    return (
        db.query(Transaccion)
        .options(joinedload(Transaccion.cuenta), joinedload(Transaccion.categoria))
        .order_by(Transaccion.fecha.desc())
        .limit(limite)
        .all()
    )

@router.post("/", response_model=TransaccionOut)
def crear_transaccion(datos: TransaccionCreate, db: Session = Depends(get_db)):
    tx = Transaccion(**datos.model_dump())
    db.add(tx)

    cuenta = db.query(Cuenta).filter(Cuenta.id == datos.cuenta_id).first()
    if cuenta:
        cuenta.saldo += datos.monto

    db.commit()
    db.refresh(tx)
    return db.query(Transaccion).options(
        joinedload(Transaccion.cuenta),
        joinedload(Transaccion.categoria)
    ).filter(Transaccion.id == tx.id).first()