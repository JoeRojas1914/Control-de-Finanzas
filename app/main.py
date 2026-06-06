from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from app.database import engine
from app import models
from app.routers import (
    auth, cuentas, transacciones, rendimientos, dashboard,
    categorias, reportes, recurrentes, presupuestos,
    transferencias, rendimientos_programados, metas, msi,
)

models.Base.metadata.create_all(bind=engine)

# Migraciones manuales para columnas nuevas en tablas existentes
from sqlalchemy import text
def _migrar():
    columnas = [
        ("cuentas",   "dia_corte",        "INTEGER"),
        ("cuentas",   "dia_pago",         "INTEGER"),
        ("usuarios",  "nombre",           "VARCHAR"),
        ("usuarios",  "apellido",         "VARCHAR"),
        ("usuarios",  "correo",           "VARCHAR"),
        ("usuarios",  "fecha_nacimiento", "DATETIME"),
        ("usuarios",  "moneda",           "VARCHAR"),
        ("usuarios",  "avatar_color",     "VARCHAR"),
        ("msi",       "transaccion_id",   "INTEGER"),
    ]
    with engine.begin() as conn:
        for tabla, col, tipo in columnas:
            try:
                conn.execute(text(f"ALTER TABLE {tabla} ADD COLUMN {col} {tipo}"))
            except Exception:
                pass  # columna ya existe
_migrar()

app = FastAPI(title="Control de Finanzas")

# /api/auth/register es público — los demás endpoints verifican usuario dentro del router
app.include_router(auth.router)
app.include_router(cuentas.router)
app.include_router(transacciones.router)
app.include_router(rendimientos.router)
app.include_router(dashboard.router)
app.include_router(categorias.router)
app.include_router(reportes.router)
app.include_router(recurrentes.router)
app.include_router(presupuestos.router)
app.include_router(transferencias.router)
app.include_router(rendimientos_programados.router)
app.include_router(metas.router)
app.include_router(msi.router)

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def root():
    return RedirectResponse(url="/static/login.html")
