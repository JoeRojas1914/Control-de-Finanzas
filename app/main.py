from fastapi import FastAPI, Depends
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from app.database import engine
from app import models
from app.auth import verificar_credenciales
from app.routers import cuentas, transacciones, rendimientos, dashboard, categorias, reportes, recurrentes, presupuestos, transferencias, rendimientos_programados

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Control de Finanzas", dependencies=[Depends(verificar_credenciales)])

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

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def root():
    return RedirectResponse(url="/static/login.html")