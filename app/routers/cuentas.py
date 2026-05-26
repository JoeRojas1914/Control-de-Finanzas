from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Cuenta, Usuario
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
    cuenta = db.query(Cuenta).filter(Cuenta.id == cuenta_id, Cuenta.usuario_id == user.id).first()
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    from app.models import Transaccion, RendimientoDiario
    tiene_tx   = db.query(Transaccion).filter(Transaccion.cuenta_id == cuenta_id).first()
    tiene_rend = db.query(RendimientoDiario).filter(RendimientoDiario.cuenta_id == cuenta_id).first()

    if tiene_tx or tiene_rend:
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar una cuenta con transacciones o rendimientos registrados"
        )

    db.delete(cuenta)
    db.commit()
    return {"ok": True}
