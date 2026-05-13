from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime
from app.database import get_db
from app.models import RendimientoDiario
from app.schemas import RendimientoCreate, RendimientoOut

router = APIRouter(prefix="/api/rendimientos", tags=["rendimientos"])

@router.post("/", response_model=RendimientoOut)
def registrar_rendimiento(datos: RendimientoCreate, db: Session = Depends(get_db)):
    rendimiento = RendimientoDiario(
        cuenta_id = datos.cuenta_id,
        monto     = datos.monto,
        fecha     = datos.fecha or datetime.utcnow()
    )
    db.add(rendimiento)
    db.commit()
    db.refresh(rendimiento)
    return rendimiento