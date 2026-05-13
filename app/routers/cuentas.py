from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Cuenta
from app.schemas import CuentaCreate, CuentaOut, CuentaUpdate
from app.utils import resumen_rendimientos

router = APIRouter(prefix="/api/cuentas", tags=["cuentas"])

@router.get("/", response_model=list[CuentaOut])
def listar_cuentas(db: Session = Depends(get_db)):
    return db.query(Cuenta).all()

@router.get("/{cuenta_id}", response_model=CuentaOut)
def obtener_cuenta(cuenta_id: int, db: Session = Depends(get_db)):
    cuenta = db.query(Cuenta).filter(Cuenta.id == cuenta_id).first()
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    return cuenta

@router.post("/", response_model=CuentaOut)
def crear_cuenta(cuenta: CuentaCreate, db: Session = Depends(get_db)):
    nueva = Cuenta(**cuenta.model_dump())
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva

@router.patch("/{cuenta_id}/saldo", response_model=CuentaOut)
def actualizar_saldo(cuenta_id: int, datos: CuentaUpdate, db: Session = Depends(get_db)):
    cuenta = db.query(Cuenta).filter(Cuenta.id == cuenta_id).first()
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    cuenta.saldo = datos.saldo
    db.commit()
    db.refresh(cuenta)
    return cuenta

@router.get("/{cuenta_id}/rendimientos")
def rendimientos_cuenta(cuenta_id: int, db: Session = Depends(get_db)):
    cuenta = db.query(Cuenta).filter(Cuenta.id == cuenta_id).first()
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    return resumen_rendimientos(cuenta.rendimientos)


from app.models import Cuenta, Categoria
from app.schemas import CuentaCreate, CuentaOut, CuentaUpdate, CategoriaOut

@router.get("/categorias/", response_model=list[CategoriaOut], tags=["categorias"])
def listar_categorias(db: Session = Depends(get_db)):
    return db.query(Categoria).all()