"""
Seed de datos de demostracion — 6 meses de historial realista.

Uso:
    python -m app.seed_demo

Crea el usuario test/test y le asigna todos los datos de demo.
Si el usuario ya existe, reutiliza su ID y superpone los datos.
"""
import random
from calendar import monthrange
from datetime import datetime, timedelta

from app.database import SessionLocal, engine
from app import models
from app.auth import hash_password

models.Base.metadata.create_all(bind=engine)

random.seed(42)
HOY = datetime(2026, 5, 26)


def _d(year, month, day, hour=12):
    return datetime(year, month, day, hour, 0, 0)


def _build_tx(desc, monto, year, month, dia, max_d, cta_id, cat_id):
    if 1 <= dia <= max_d:
        return models.Transaccion(
            descripcion=desc, monto=monto,
            fecha=_d(year, month, dia),
            cuenta_id=cta_id,
            categoria_id=cat_id,
        )
    return None


def _txs_del_mes(año, mes, bbva_id, nu_id, C):
    _, dias_mes = monthrange(año, mes)
    max_d = 26 if (año == 2026 and mes == 5) else dias_mes
    txs = []

    def add(desc, monto, dia, cta_id, cat):
        t = _build_tx(desc, monto, año, mes, dia, max_d, cta_id, C[cat])
        if t:
            txs.append(t)

    super_places = ["HEB", "Walmart", "La Comer", "Costco", "Soriana"]
    super_montos = [-2_340, -1_870, -3_120, -980, -1_540, -2_090, -1_280]
    rest_places  = ["Tacos el Guero", "La Nortena", "Starbucks", "McDonald's",
                    "Sushi Itto", "Tony Roma's", "El Porton", "Vips"]
    rest_montos  = [-180, -340, -95, -220, -650, -420, -310, -580]

    # Nomina
    add("Nomina quincenal", 12_500, 1,  bbva_id, "Otros")
    add("Nomina quincenal", 12_500, 15, bbva_id, "Otros")
    # Renta
    add("Renta departamento", -8_500, 5, bbva_id, "Otros")
    # Suscripciones
    add("Netflix",      -219, 10, nu_id, "Suscripciones")
    add("Spotify",      -99,  10, nu_id, "Suscripciones")
    add("iCloud 200GB", -39,  12, nu_id, "Suscripciones")

    # Supermercado 4x
    pool  = list(range(2, max_d))
    dias_s = sorted(random.sample(pool, min(4, len(pool))))
    for i, dia in enumerate(dias_s):
        txs.append(models.Transaccion(
            descripcion=random.choice(super_places),
            monto=super_montos[i % len(super_montos)],
            fecha=_d(año, mes, dia),
            cuenta_id=bbva_id, categoria_id=C["Comida"],
        ))

    # Restaurantes 4x
    pool2  = [x for x in range(3, max_d) if x not in dias_s]
    dias_r = sorted(random.sample(pool2, min(4, len(pool2))))
    for i, dia in enumerate(dias_r):
        txs.append(models.Transaccion(
            descripcion=random.choice(rest_places),
            monto=rest_montos[i % len(rest_montos)],
            fecha=_d(año, mes, dia),
            cuenta_id=nu_id, categoria_id=C["Entretenimiento"],
        ))

    # Gasolina 2x
    for dia in sorted(random.sample(range(2, max_d), min(2, max_d - 2))):
        add("Gasolina PEMEX", round(random.uniform(-650, -1_100), 2),
            dia, bbva_id, "Transporte")

    # Uber/DiDi 2x
    for dia in sorted(random.sample(range(1, max_d), min(2, max_d - 1))):
        add(random.choice(["Uber", "DiDi"]),
            round(random.uniform(-120, -380), 2),
            dia, nu_id, "Transporte")

    # Pago TC
    add("Pago tarjeta Nu", -5_500, 20, bbva_id, "Pago TC")

    # Salud — ocasional
    if mes in [12, 2, 4]:
        add("Farmacia Guadalajara",
            round(random.uniform(-180, -640), 2),
            random.randint(8, min(20, max_d)), nu_id, "Salud")
    if mes == 3:
        add("Consulta medico general", -800, 14, nu_id, "Salud")

    # Compras — ocasional
    if mes in [12, 1, 3]:
        add("Amazon.com.mx", round(random.uniform(-350, -1_200), 2),
            random.randint(5, min(25, max_d)), nu_id, "Otros")
    if mes in [1, 4]:
        add("Zara", round(random.uniform(-800, -2_100), 2),
            random.randint(10, min(22, max_d)), nu_id, "Ropa")
    if mes in [1, 2]:
        add("Coursera", -399, 8, nu_id, "Educacion")

    # Viaje — marzo
    if mes == 3:
        add("Vuelo CDMX-GDL VivaAerobus", -2_340, 18, nu_id, "Viajes")
        add("Hotel NH Guadalajara",        -1_890, 18, nu_id, "Viajes")

    # Navidad — diciembre
    if mes == 12:
        add("Liverpool - regalos navidenos", -3_400, 22, nu_id, "Ropa")
        add("Cena familiar",                 -1_200, 24, bbva_id, "Comida")

    return txs


def seed_demo():
    db = SessionLocal()
    print("Generando datos de demo...\n")

    # ── Usuario test ──────────────────────────────────────────
    user = db.query(models.Usuario).filter(models.Usuario.username == "test").first()
    if not user:
        user = models.Usuario(username="test", password_hash=hash_password("test"))
        db.add(user)
        db.flush()
        print("  ok  usuario test creado")
    else:
        print("  ok  usuario test ya existe, reutilizando")
    uid = user.id

    # ── Categorias ────────────────────────────────────────────
    nombres_cats = [
        "Comida", "Transporte", "Suscripciones", "Salud",
        "Entretenimiento", "Rendimiento", "Pago TC", "Otros",
        "Educacion", "Ropa", "Viajes",
    ]
    existentes = {c.nombre: c.id for c in db.query(models.Categoria).filter(models.Categoria.usuario_id == uid).all()}
    nuevas = [models.Categoria(nombre=n, usuario_id=uid) for n in nombres_cats if n not in existentes]
    if nuevas:
        db.add_all(nuevas)
        db.flush()
    C = {**existentes, **{c.nombre: c.id for c in nuevas}}
    print(f"  ok  categorias: {len(existentes)} existentes + {len(nuevas)} nuevas")

    # ── Cuentas ───────────────────────────────────────────────
    bbva     = models.Cuenta(nombre="BBVA Nomina",  tipo="debito",  saldo=38_420.50, usuario_id=uid)
    gbm      = models.Cuenta(nombre="GBM+",         tipo="debito",  saldo=142_870.00, usuario_id=uid)
    efectivo = models.Cuenta(nombre="Efectivo",     tipo="debito",  saldo=1_800.00, usuario_id=uid)
    nu       = models.Cuenta(nombre="Tarjeta Nu",   tipo="credito", saldo=-9_240.00, limite=30_000, usuario_id=uid)
    db.add_all([bbva, gbm, efectivo, nu])
    db.flush()
    print("  ok  4 cuentas")

    # ── Transacciones ─────────────────────────────────────────
    meses = [(2025, 12), (2026, 1), (2026, 2), (2026, 3), (2026, 4), (2026, 5)]
    txs = []
    for año, mes in meses:
        txs.extend(_txs_del_mes(año, mes, bbva.id, nu.id, C))
    db.add_all(txs)
    print(f"  ok  {len(txs)} transacciones (6 meses)")

    # ── Rendimientos diarios ──────────────────────────────────
    rends = [
        models.RendimientoDiario(
            cuenta_id=gbm.id,
            monto=round(max(8.0, random.gauss(62, 18)), 2),
            fecha=HOY - timedelta(days=150 - i),
        )
        for i in range(150)
    ]
    db.add_all(rends)
    print(f"  ok  {len(rends)} rendimientos diarios (GBM+)")

    # ── Transferencias ────────────────────────────────────────
    tfs = [
        models.Transferencia(cuenta_origen_id=bbva.id, cuenta_destino_id=gbm.id,
                             monto=5_000, descripcion="Ahorro mensual",
                             fecha=_d(2025, 12, 28)),
        models.Transferencia(cuenta_origen_id=bbva.id, cuenta_destino_id=gbm.id,
                             monto=5_000, descripcion="Ahorro mensual",
                             fecha=_d(2026, 1, 28)),
        models.Transferencia(cuenta_origen_id=bbva.id, cuenta_destino_id=gbm.id,
                             monto=5_000, descripcion="Ahorro mensual",
                             fecha=_d(2026, 2, 28)),
        models.Transferencia(cuenta_origen_id=bbva.id, cuenta_destino_id=gbm.id,
                             monto=7_000, descripcion="Ahorro extra marzo",
                             fecha=_d(2026, 3, 28)),
        models.Transferencia(cuenta_origen_id=bbva.id, cuenta_destino_id=gbm.id,
                             monto=5_000, descripcion="Ahorro mensual",
                             fecha=_d(2026, 4, 28)),
        models.Transferencia(cuenta_origen_id=bbva.id, cuenta_destino_id=efectivo.id,
                             monto=1_000, descripcion="Retiro cajero",
                             fecha=_d(2026, 5, 10)),
    ]
    db.add_all(tfs)
    print(f"  ok  {len(tfs)} transferencias")

    # ── Presupuestos ──────────────────────────────────────────
    pres_data = [
        ("Comida", 7_000), ("Transporte", 2_000), ("Entretenimiento", 1_500),
        ("Suscripciones", 600), ("Salud", 1_000), ("Ropa", 1_500),
    ]
    pres = [
        models.Presupuesto(categoria_id=C[cat], monto_limite=limite, usuario_id=uid)
        for cat, limite in pres_data
        if cat in C
    ]
    db.add_all(pres)
    print(f"  ok  {len(pres)} presupuestos")

    # ── Metas ─────────────────────────────────────────────────
    metas = [
        models.Meta(nombre="Fondo de emergencia", emoji="alcancia",
                    monto_objetivo=50_000, monto_actual=28_000,
                    fecha_objetivo=_d(2026, 12, 31), usuario_id=uid),
        models.Meta(nombre="Vacaciones Cancun", emoji="plane",
                    monto_objetivo=15_000, monto_actual=4_500,
                    fecha_objetivo=_d(2026, 7, 15), usuario_id=uid),
        models.Meta(nombre="Laptop nueva", emoji="smartphone",
                    monto_objetivo=25_000, monto_actual=8_000,
                    fecha_objetivo=_d(2026, 9, 1), usuario_id=uid),
        models.Meta(nombre="Auto", emoji="car",
                    monto_objetivo=80_000, monto_actual=12_000,
                    fecha_objetivo=_d(2027, 6, 1), usuario_id=uid),
    ]
    db.add_all(metas)
    print(f"  ok  {len(metas)} metas")

    # ── Recurrentes ───────────────────────────────────────────
    recs = [
        models.TransaccionRecurrente(
            descripcion="Renta departamento", monto=-8_500, frecuencia="mensual",
            proxima_fecha=_d(2026, 6, 5), activa=True,
            cuenta_id=bbva.id, categoria_id=C.get("Otros"), usuario_id=uid),
        models.TransaccionRecurrente(
            descripcion="Netflix", monto=-219, frecuencia="mensual",
            proxima_fecha=_d(2026, 6, 10), activa=True,
            cuenta_id=nu.id, categoria_id=C.get("Suscripciones"), usuario_id=uid),
        models.TransaccionRecurrente(
            descripcion="Spotify", monto=-99, frecuencia="mensual",
            proxima_fecha=_d(2026, 6, 10), activa=True,
            cuenta_id=nu.id, categoria_id=C.get("Suscripciones"), usuario_id=uid),
        models.TransaccionRecurrente(
            descripcion="Gimnasio Sport City", monto=-500, frecuencia="mensual",
            proxima_fecha=_d(2026, 6, 1), activa=True,
            cuenta_id=bbva.id, categoria_id=C.get("Salud"), usuario_id=uid),
        models.TransaccionRecurrente(
            descripcion="iCloud 200GB", monto=-39, frecuencia="mensual",
            proxima_fecha=_d(2026, 6, 12), activa=False,
            cuenta_id=nu.id, categoria_id=C.get("Suscripciones"), usuario_id=uid),
    ]
    db.add_all(recs)
    print(f"  ok  {len(recs)} recurrentes (1 pausada: iCloud)")

    db.commit()
    db.close()

    print("""
--- Demo lista ---

  Cuentas:      BBVA Nomina / GBM+ / Efectivo / Tarjeta Nu
  Historial:    6 meses (dic 2025 - may 2026)
  Rendimientos: 150 dias de GBM+
  Presupuestos: 6 categorias
  Metas:        4
  Recurrentes:  5 (4 activas / 1 pausada)

  Servidor:  uvicorn app.main:app --reload
  URL:       http://localhost:8000
  Login:     usuario=test  contrasena=test
""")


if __name__ == "__main__":
    seed_demo()
