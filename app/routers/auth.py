from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.database import get_db
from app.models import (Usuario, Cuenta, Transaccion, RendimientoDiario, Transferencia,
                        TransaccionRecurrente, HorarioRendimiento, RendimientoProgramado,
                        Presupuesto, Meta, Categoria)
from app.auth import hash_password, verify_password, get_current_user, create_token
from app.limiter import limiter

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username:         str
    password:         str
    nombre:           str
    apellido:         str
    correo:           str
    fecha_nacimiento: str
    moneda:           Optional[str] = "MXN"
    avatar_color:     Optional[str] = "#6366f1"


class PerfilUpdate(BaseModel):
    nombre:           Optional[str] = None
    apellido:         Optional[str] = None
    correo:           Optional[str] = None
    fecha_nacimiento: Optional[str] = None
    moneda:           Optional[str] = None
    avatar_color:     Optional[str] = None


class PasswordUpdate(BaseModel):
    clave_actual: str
    clave_nueva:  str


@router.post("/login")
@limiter.limit("10/minute")
def login(request: Request, datos: LoginRequest, db: Session = Depends(get_db)):
    identifier = datos.username.strip().lower()
    user = db.query(Usuario).filter(Usuario.username == identifier).first()
    if not user:
        user = db.query(Usuario).filter(Usuario.correo == identifier).first()
    if not user or not verify_password(datos.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
    return {"access_token": create_token(user.id), "token_type": "bearer"}


@router.post("/register")
@limiter.limit("5/hour")
def register(request: Request, datos: RegisterRequest, db: Session = Depends(get_db)):
    username = datos.username.strip().lower()
    if not username or not datos.password:
        raise HTTPException(status_code=422, detail="Usuario y contraseña son obligatorios")
    if len(datos.password) < 4:
        raise HTTPException(status_code=422, detail="La contraseña debe tener al menos 4 caracteres")
    if not datos.nombre.strip() or not datos.apellido.strip():
        raise HTTPException(status_code=422, detail="Nombre y apellido son obligatorios")
    if not datos.correo.strip() or not datos.fecha_nacimiento:
        raise HTTPException(status_code=422, detail="Correo y fecha de nacimiento son obligatorios")
    if db.query(Usuario).filter(Usuario.username == username).first():
        raise HTTPException(status_code=400, detail="Ese nombre de usuario ya existe")
    correo = datos.correo.strip().lower()
    if correo and db.query(Usuario).filter(Usuario.correo == correo).first():
        raise HTTPException(status_code=400, detail="Ese correo ya está registrado")
    user = Usuario(
        username=username,
        password_hash=hash_password(datos.password),
        nombre=datos.nombre.strip() if datos.nombre else None,
        apellido=datos.apellido.strip() if datos.apellido else None,
        correo=correo,
        fecha_nacimiento=datetime.fromisoformat(datos.fecha_nacimiento) if datos.fecha_nacimiento else None,
        moneda=datos.moneda or "MXN",
        avatar_color=datos.avatar_color or "#6366f1",
    )
    db.add(user)
    db.commit()
    return {"ok": True, "username": username}


@router.get("/me")
def me(user: Usuario = Depends(get_current_user)):
    return {
        "id":               user.id,
        "username":         user.username,
        "nombre":           user.nombre,
        "apellido":         user.apellido,
        "correo":           user.correo,
        "fecha_nacimiento": user.fecha_nacimiento.date().isoformat() if user.fecha_nacimiento else None,
        "moneda":           user.moneda or "MXN",
        "avatar_color":     user.avatar_color or "#6366f1",
        "creado_en":        user.creado_en,
    }


@router.patch("/me")
def actualizar_perfil(
    datos: PerfilUpdate,
    db:   Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    for campo, valor in datos.model_dump(exclude_none=True).items():
        if campo == "fecha_nacimiento" and valor:
            setattr(user, campo, datetime.fromisoformat(valor))
        else:
            setattr(user, campo, valor)
    db.commit()
    return {"ok": True}


@router.delete("/me")
def eliminar_cuenta_usuario(
    db:   Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    ids = [r[0] for r in db.query(Cuenta.id).filter(Cuenta.usuario_id == user.id).all()]

    if ids:
        db.query(Transaccion).filter(Transaccion.cuenta_id.in_(ids)).delete(synchronize_session=False)
        db.query(RendimientoDiario).filter(RendimientoDiario.cuenta_id.in_(ids)).delete(synchronize_session=False)
        db.query(Transferencia).filter(
            (Transferencia.cuenta_origen_id.in_(ids)) | (Transferencia.cuenta_destino_id.in_(ids))
        ).delete(synchronize_session=False)

    db.query(TransaccionRecurrente).filter(TransaccionRecurrente.usuario_id == user.id).delete(synchronize_session=False)
    db.query(HorarioRendimiento).filter(HorarioRendimiento.usuario_id == user.id).delete(synchronize_session=False)
    db.query(RendimientoProgramado).filter(RendimientoProgramado.usuario_id == user.id).delete(synchronize_session=False)
    db.query(Presupuesto).filter(Presupuesto.usuario_id == user.id).delete(synchronize_session=False)
    db.query(Meta).filter(Meta.usuario_id == user.id).delete(synchronize_session=False)
    db.query(Cuenta).filter(Cuenta.usuario_id == user.id).delete(synchronize_session=False)
    db.query(Categoria).filter(Categoria.usuario_id == user.id).delete(synchronize_session=False)
    db.delete(user)
    db.commit()
    return {"ok": True}


@router.patch("/password")
def cambiar_password(
    datos: PasswordUpdate,
    db:   Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    if not verify_password(datos.clave_actual, user.password_hash):
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")
    if len(datos.clave_nueva) < 4:
        raise HTTPException(status_code=422, detail="La nueva contraseña debe tener al menos 4 caracteres")
    user.password_hash = hash_password(datos.clave_nueva)
    db.commit()
    return {"ok": True}
