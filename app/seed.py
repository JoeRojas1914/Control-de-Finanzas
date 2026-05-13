from app.database import SessionLocal, engine
from app.models import Cuenta, Categoria, TipoCuenta, Base

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    cuentas = [
        Cuenta(nombre="Openbank", tipo=TipoCuenta.debito,  saldo=0.0),
        Cuenta(nombre="Nu",       tipo=TipoCuenta.debito,  saldo=0.0),
        Cuenta(nombre="Revolut",  tipo=TipoCuenta.debito,  saldo=0.0),
        Cuenta(nombre="Tarjeta",  tipo=TipoCuenta.credito, saldo=0.0, limite=20000.0),
    ]

    categorias = [
        Categoria(nombre="Comida"),
        Categoria(nombre="Transporte"),
        Categoria(nombre="Suscripciones"),
        Categoria(nombre="Salud"),
        Categoria(nombre="Entretenimiento"),
        Categoria(nombre="Rendimiento"),
        Categoria(nombre="Pago TC"),
        Categoria(nombre="Otros"),
    ]

    db.add_all(cuentas)
    db.add_all(categorias)
    db.commit()
    db.close()
    print("✓ Datos iniciales insertados")

if __name__ == "__main__":
    seed()