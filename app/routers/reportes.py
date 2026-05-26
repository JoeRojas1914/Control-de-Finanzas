from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from calendar import monthrange
from app.database import get_db
from app.models import Transaccion, Cuenta, TipoCuenta, Categoria, Usuario
from app.auth import get_current_user

router = APIRouter(prefix="/api/reportes", tags=["reportes"])


def _cuenta_ids(db: Session, user_id: int):
    return [r[0] for r in db.query(Cuenta.id).filter(Cuenta.usuario_id == user_id).all()]


@router.get("/gastos-por-categoria")
def gastos_por_categoria(db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    ids = _cuenta_ids(db, user.id)
    inicio_mes = datetime.now().replace(day=1, hour=0, minute=0, second=0)

    resultados = (
        db.query(Transaccion.categoria_id, func.sum(Transaccion.monto).label("total"))
        .filter(
            Transaccion.cuenta_id.in_(ids),
            Transaccion.monto < 0,
            Transaccion.fecha >= inicio_mes,
        )
        .group_by(Transaccion.categoria_id)
        .all()
    )

    categorias = {c.id: c.nombre for c in db.query(Categoria).filter(Categoria.usuario_id == user.id).all()}

    return [
        {"categoria": categorias.get(r.categoria_id, "Sin categoría"), "total": round(abs(r.total), 2)}
        for r in resultados
    ]


@router.get("/patrimonio-historico")
def patrimonio_historico(db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    ids  = _cuenta_ids(db, user.id)
    hoy  = datetime.now().date()
    dias = [(hoy - timedelta(days=i)) for i in range(29, -1, -1)]

    cuentas_debito = db.query(Cuenta).filter(Cuenta.usuario_id == user.id, Cuenta.tipo == TipoCuenta.debito).all()
    saldo_actual   = sum(c.saldo for c in cuentas_debito)

    transacciones = (
        db.query(Transaccion)
        .filter(
            Transaccion.cuenta_id.in_(ids),
            Transaccion.fecha >= datetime.combine(dias[0], datetime.min.time()),
        )
        .all()
    )

    movimientos_por_dia = {}
    for tx in transacciones:
        dia = tx.fecha.date()
        movimientos_por_dia[dia] = movimientos_por_dia.get(dia, 0) + tx.monto

    puntos = []
    saldo  = saldo_actual
    for dia in reversed(dias):
        puntos.insert(0, {"fecha": dia.strftime("%d %b"), "saldo": round(saldo, 2)})
        saldo -= movimientos_por_dia.get(dia, 0)

    return puntos


@router.get("/ingresos-vs-gastos")
def ingresos_vs_gastos(db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    ids = _cuenta_ids(db, user.id)
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
            Transaccion.cuenta_id.in_(ids),
            Transaccion.fecha >= inicio,
            Transaccion.fecha <= fin,
        ).all()

        ingresos = sum(t.monto for t in txs if t.monto > 0)
        gastos   = sum(abs(t.monto) for t in txs if t.monto < 0)
        label    = datetime(año, mes, 1).strftime("%b %Y")

        resultado.append({"mes": label, "ingresos": round(ingresos, 2), "gastos": round(gastos, 2)})

    return resultado


@router.get("/resumen-mes")
def resumen_mes(db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    ids  = _cuenta_ids(db, user.id)
    hoy  = datetime.now()
    inicio_mes = hoy.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    mes_ant   = hoy.month - 1 or 12
    año_ant   = hoy.year if hoy.month > 1 else hoy.year - 1
    inicio_ant = datetime(año_ant, mes_ant, 1)

    txs_mes = db.query(Transaccion).filter(
        Transaccion.cuenta_id.in_(ids), Transaccion.fecha >= inicio_mes
    ).all()
    txs_ant = db.query(Transaccion).filter(
        Transaccion.cuenta_id.in_(ids),
        Transaccion.fecha >= inicio_ant,
        Transaccion.fecha <  inicio_mes,
    ).all()

    ingresos = sum(t.monto      for t in txs_mes if t.monto > 0)
    gastos   = sum(abs(t.monto) for t in txs_mes if t.monto < 0)
    balance  = ingresos - gastos
    tasa_ahorro = round(balance / ingresos * 100, 1) if ingresos > 0 else 0

    gasto_diario_prom = round(gastos / max(hoy.day, 1), 2)
    gastos_ant  = sum(abs(t.monto) for t in txs_ant if t.monto < 0)
    variacion   = round((gastos - gastos_ant) / gastos_ant * 100, 1) if gastos_ant > 0 else None

    cats = {c.id: c.nombre for c in db.query(Categoria).filter(Categoria.usuario_id == user.id).all()}
    top_gastos = sorted([t for t in txs_mes if t.monto < 0], key=lambda t: t.monto)[:5]

    return {
        "ingresos":          round(ingresos, 2),
        "gastos":            round(gastos, 2),
        "balance":           round(balance, 2),
        "tasa_ahorro":       tasa_ahorro,
        "gasto_diario_prom": gasto_diario_prom,
        "variacion_gastos":  variacion,
        "top_gastos": [
            {
                "descripcion": t.descripcion,
                "monto":       round(abs(t.monto), 2),
                "categoria":   cats.get(t.categoria_id, "Sin categoría"),
            }
            for t in top_gastos
        ],
    }
