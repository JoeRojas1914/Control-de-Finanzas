import os
import base64
import secrets
from fastapi import Request, HTTPException


def verificar_credenciales(request: Request):
    auth_pass = os.getenv("AUTH_PASS", "")
    if not auth_pass:
        return  # Auth deshabilitada en desarrollo local

    header = request.headers.get("Authorization", "")
    if not header.startswith("Basic "):
        raise HTTPException(status_code=401, detail="No autorizado")

    try:
        usuario, clave = base64.b64decode(header[6:]).decode().split(":", 1)
    except Exception:
        raise HTTPException(status_code=401, detail="No autorizado")

    auth_user = os.getenv("AUTH_USER", "admin")
    usuario_ok = secrets.compare_digest(usuario.encode(), auth_user.encode())
    clave_ok   = secrets.compare_digest(clave.encode(),   auth_pass.encode())

    if not (usuario_ok and clave_ok):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
