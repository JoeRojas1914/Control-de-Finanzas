from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import Transaccion, Cuenta, TipoCuenta
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
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    if cuenta.tipo == TipoCuenta.credito and cuenta.limite is not None and datos.monto < 0:
        nueva_deuda = abs(cuenta.saldo + datos.monto)
        if nueva_deuda > cuenta.limite:
            raise HTTPException(
                status_code=400,
                detail=f"La transacción supera el límite de crédito de ${cuenta.limite:,.2f}"
            )

    cuenta.saldo += datos.monto

    db.commit()
    db.refresh(tx)
    return db.query(Transaccion).options(
        joinedload(Transaccion.cuenta),
        joinedload(Transaccion.categoria)
    ).filter(Transaccion.id == tx.id).first()