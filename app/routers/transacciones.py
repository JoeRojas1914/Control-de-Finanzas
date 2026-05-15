from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import Transaccion, Cuenta, TipoCuenta
from app.schemas import TransaccionCreate, TransaccionOut

router = APIRouter(prefix="/api/transacciones", tags=["transacciones"])

@router.get("/", response_model=list[TransaccionOut])
def listar_transacciones(limite: int = 20, cuenta_id: int = None, db: Session = Depends(get_db)):
    q = (
        db.query(Transaccion)
        .options(joinedload(Transaccion.cuenta), joinedload(Transaccion.categoria))
        .order_by(Transaccion.fecha.desc())
    )
    if cuenta_id is not None:
        q = q.filter(Transaccion.cuenta_id == cuenta_id)
    return q.limit(limite).all()

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

@router.patch("/{tx_id}", response_model=TransaccionOut)
def editar_transaccion(tx_id: int, datos: TransaccionCreate, db: Session = Depends(get_db)):
    tx = db.query(Transaccion).filter(Transaccion.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")

    cuenta_vieja = db.query(Cuenta).filter(Cuenta.id == tx.cuenta_id).first()
    if cuenta_vieja:
        cuenta_vieja.saldo -= tx.monto

    tx.descripcion  = datos.descripcion
    tx.monto        = datos.monto
    tx.cuenta_id    = datos.cuenta_id
    tx.categoria_id = datos.categoria_id
    if datos.fecha:
        tx.fecha = datos.fecha

    cuenta_nueva = db.query(Cuenta).filter(Cuenta.id == datos.cuenta_id).first()
    if not cuenta_nueva:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    cuenta_nueva.saldo += datos.monto

    db.commit()
    return db.query(Transaccion).options(
        joinedload(Transaccion.cuenta),
        joinedload(Transaccion.categoria)
    ).filter(Transaccion.id == tx_id).first()

@router.delete("/{tx_id}")
def eliminar_transaccion(tx_id: int, db: Session = Depends(get_db)):
    tx = db.query(Transaccion).filter(Transaccion.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")

    cuenta = db.query(Cuenta).filter(Cuenta.id == tx.cuenta_id).first()
    if cuenta:
        cuenta.saldo -= tx.monto

    db.delete(tx)
    db.commit()
    return {"ok": True}