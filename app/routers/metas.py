from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Meta
from app.schemas import MetaCreate, MetaUpdate, MetaOut

router = APIRouter(prefix="/api/metas", tags=["metas"])


@router.get("/", response_model=list[MetaOut])
def listar_metas(db: Session = Depends(get_db)):
    return db.query(Meta).order_by(Meta.creada_en).all()


@router.post("/", response_model=MetaOut)
def crear_meta(datos: MetaCreate, db: Session = Depends(get_db)):
    meta = Meta(**datos.model_dump())
    db.add(meta)
    db.commit()
    db.refresh(meta)
    return meta


@router.patch("/{meta_id}", response_model=MetaOut)
def editar_meta(meta_id: int, datos: MetaUpdate, db: Session = Depends(get_db)):
    meta = db.query(Meta).filter(Meta.id == meta_id).first()
    if not meta:
        raise HTTPException(status_code=404, detail="Meta no encontrada")
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(meta, campo, valor)
    db.commit()
    db.refresh(meta)
    return meta


@router.delete("/{meta_id}")
def eliminar_meta(meta_id: int, db: Session = Depends(get_db)):
    meta = db.query(Meta).filter(Meta.id == meta_id).first()
    if not meta:
        raise HTTPException(status_code=404, detail="Meta no encontrada")
    db.delete(meta)
    db.commit()
    return {"ok": True}
