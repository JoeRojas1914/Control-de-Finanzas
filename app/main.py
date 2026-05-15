from fastapi import FastAPI, Depends
from fastapi.staticfiles import StaticFiles
from app.database import engine
from app import models
from app.auth import verificar_credenciales
from app.routers import cuentas, transacciones, rendimientos, dashboard, categorias, reportes, recurrentes

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Control de Finanzas", dependencies=[Depends(verificar_credenciales)])

app.include_router(cuentas.router)
app.include_router(transacciones.router)
app.include_router(rendimientos.router)
app.include_router(dashboard.router)
app.include_router(categorias.router)
app.include_router(reportes.router)
app.include_router(recurrentes.router)

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def root():
    return {"status": "ok"}