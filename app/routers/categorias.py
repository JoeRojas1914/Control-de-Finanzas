from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Categoria, Transaccion, Usuario
from app.schemas import CategoriaOut, CategoriaCreate
from app.auth import get_current_user

router = APIRouter(prefix="/api/categorias", tags=["categorias"])


@router.get("/", response_model=list[CategoriaOut])
def listar_categorias(db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    return db.query(Categoria).filter(Categoria.usuario_id == user.id).all()


@router.post("/", response_model=CategoriaOut)
def crear_categoria(datos: CategoriaCreate, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    nombre = datos.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=422, detail="El nombre no puede estar vacío")
    existe = db.query(Categoria).filter(Categoria.nombre == nombre, Categoria.usuario_id == user.id).first()
    if existe:
        raise HTTPException(status_code=400, detail=f'Ya existe la categoría "{nombre}"')
    nueva = Categoria(nombre=nombre, usuario_id=user.id)
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


@router.patch("/{categoria_id}", response_model=CategoriaOut)
def renombrar_categoria(categoria_id: int, datos: CategoriaCreate, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    cat = db.query(Categoria).filter(Categoria.id == categoria_id, Categoria.usuario_id == user.id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    nombre = datos.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=422, detail="El nombre no puede estar vacío")
    existe = db.query(Categoria).filter(
        Categoria.nombre == nombre, Categoria.usuario_id == user.id, Categoria.id != categoria_id
    ).first()
    if existe:
        raise HTTPException(status_code=400, detail=f'Ya existe la categoría "{nombre}"')
    cat.nombre = nombre
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{categoria_id}")
def eliminar_categoria(categoria_id: int, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    cat = db.query(Categoria).filter(Categoria.id == categoria_id, Categoria.usuario_id == user.id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    tiene_tx = db.query(Transaccion).filter(Transaccion.categoria_id == categoria_id).first()
    if tiene_tx:
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar una categoría con transacciones registradas"
        )
    db.delete(cat)
    db.commit()
    return {"ok": True}
