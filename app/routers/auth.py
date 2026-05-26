from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models import Usuario
from app.auth import hash_password, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    username: str
    password: str


@router.post("/register")
def register(datos: RegisterRequest, db: Session = Depends(get_db)):
    username = datos.username.strip().lower()
    if not username or not datos.password:
        raise HTTPException(status_code=422, detail="Usuario y contraseña son obligatorios")
    if len(datos.password) < 4:
        raise HTTPException(status_code=422, detail="La contraseña debe tener al menos 4 caracteres")
    if db.query(Usuario).filter(Usuario.username == username).first():
        raise HTTPException(status_code=400, detail="Ese nombre de usuario ya existe")
    user = Usuario(username=username, password_hash=hash_password(datos.password))
    db.add(user)
    db.commit()
    return {"ok": True, "username": username}


@router.get("/me")
def me(user: Usuario = Depends(get_current_user)):
    return {"id": user.id, "username": user.username}
