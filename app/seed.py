from app.database import SessionLocal, engine
from app.models import Categoria, Base

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    nombres = [
        "Comida", "Transporte", "Suscripciones", "Salud",
        "Entretenimiento", "Rendimiento", "Pago TC", "Otros",
    ]

    existentes = {c.nombre for c in db.query(Categoria).all()}
    nuevas = [Categoria(nombre=n) for n in nombres if n not in existentes]

    if nuevas:
        db.add_all(nuevas)
        db.commit()
        print(f"✓ {len(nuevas)} categorías insertadas")
    else:
        print("✓ Categorías ya existentes, nada que insertar")

    db.close()

if __name__ == "__main__":
    seed()
