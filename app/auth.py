import base64
from fastapi import Request, HTTPException, Depends
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from app.database import get_db
from app.models import Usuario

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def get_current_user(request: Request, db: Session = Depends(get_db)) -> Usuario:
    header = request.headers.get("Authorization", "")
    if not header.startswith("Basic "):
        raise HTTPException(
            status_code=401,
            detail="No autorizado",
            headers={"WWW-Authenticate": "Basic"},
        )
    try:
        username, password = base64.b64decode(header[6:]).decode().split(":", 1)
    except Exception:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    identifier = username.strip().lower()
    user = db.query(Usuario).filter(Usuario.username == identifier).first()
    if not user:
        user = db.query(Usuario).filter(Usuario.correo == identifier).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    return user
