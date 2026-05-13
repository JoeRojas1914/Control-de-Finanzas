from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.database import engine
from app import models

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Control de Finanzas")

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def root():
    return {"status": "ok"}