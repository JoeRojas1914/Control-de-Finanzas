from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from calendar import monthrange
from app.database import get_db
from app.models import Transaccion, Cuenta, TipoCuenta

router = APIRouter(prefix="/api/reportes", tags=["reportes"])

@router.get("/gastos-por-categoria")
def gastos_por_categoria(db: Session = Depends(get_db)):
    inicio_mes = datetime.now().replace(day=1, hour=0, minute=0, second=0)

    resultados = (
        db.query(
            Transaccion.categoria_id,
            func.sum(Transaccion.monto).label("total")
        )
        .filter(Transaccion.monto < 0)
        .filter(Transaccion.fecha >= inicio_mes)
        .group_by(Transaccion.categoria_id)
        .all()
    )

    from app.models import Categoria
    categorias = {c.id: c.nombre for c in db.query(Categoria).all()}

    return [
        {
            "categoria": categorias.get(r.categoria_id, "Sin categoría"),
            "total": round(abs(r.total), 2)
        }
        for r in resultados
    ]

@router.get("/patrimonio-historico")
def patrimonio_historico(db: Session = Depends(get_db)):
    hoy   = datetime.now().date()
    dias  = [(hoy - timedelta(days=i)) for i in range(29, -1, -1)]

    cuentas_debito = db.query(Cuenta).filter(Cuenta.tipo == TipoCuenta.debito).all()
    saldo_actual   = sum(c.saldo for c in cuentas_debito)

    transacciones = (
        db.query(Transaccion)
        .join(Cuenta, Transaccion.cuenta_id == Cuenta.id)
        .filter(Cuenta.tipo == TipoCuenta.debito)
        .filter(Transaccion.fecha >= datetime.combine(dias[0], datetime.min.time()))
        .all()
    )

    movimientos_por_dia = {}
    for tx in transacciones:
        dia = tx.fecha.date()
        movimientos_por_dia[dia] = movimientos_por_dia.get(dia, 0) + tx.monto

    puntos = []
    saldo  = saldo_actual

    for dia in reversed(dias):
        puntos.insert(0, {
            "fecha":  dia.strftime("%d %b"),
            "saldo":  round(saldo, 2)
        })
        saldo -= movimientos_por_dia.get(dia, 0)

    return puntos

@router.get("/ingresos-vs-gastos")
def ingresos_vs_gastos(db: Session = Depends(get_db)):
    hoy = datetime.now().date()
    resultado = []

    for i in range(5, -1, -1):
        año = hoy.year
        mes = hoy.month - i
        while mes <= 0:
            mes += 12
            año -= 1
        ultimo_dia = monthrange(año, mes)[1]
        inicio = datetime(año, mes, 1)
        fin    = datetime(año, mes, ultimo_dia, 23, 59, 59)

        txs = db.query(Transaccion).filter(
            Transaccion.fecha >= inicio,
            Transaccion.fecha <= fin
        ).all()

        ingresos = sum(t.monto for t in txs if t.monto > 0)
        gastos   = sum(abs(t.monto) for t in txs if t.monto < 0)
        label    = datetime(año, mes, 1).strftime("%b %Y")

        resultado.append({
            "mes":      label,
            "ingresos": round(ingresos, 2),
            "gastos":   round(gastos, 2)
        })

    return resultado