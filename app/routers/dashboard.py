from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import Cuenta, Transaccion, TipoCuenta, Usuario
from app.auth import get_current_user
from app.utils import resumen_rendimientos

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/")
def resumen_dashboard(db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    cuentas = (
        db.query(Cuenta)
        .options(joinedload(Cuenta.rendimientos))
        .filter(Cuenta.usuario_id == user.id)
        .all()
    )

    debito  = [c for c in cuentas if c.tipo == TipoCuenta.debito]
    credito = [c for c in cuentas if c.tipo == TipoCuenta.credito]

    patrimonio    = sum(c.saldo for c in debito)
    deuda_tarjeta = abs(sum(c.saldo for c in credito))

    rendimientos_totales = {"diario": 0.0, "mensual": 0.0, "anual": 0.0}
    for cuenta in debito:
        r = resumen_rendimientos(cuenta.rendimientos)
        rendimientos_totales["diario"]  += r["diario"]
        rendimientos_totales["mensual"] += r["mensual"]
        rendimientos_totales["anual"]   += r["anual"]

    ids = [c.id for c in cuentas]
    ultimas_tx = (
        db.query(Transaccion)
        .options(joinedload(Transaccion.cuenta), joinedload(Transaccion.categoria))
        .filter(Transaccion.cuenta_id.in_(ids))
        .order_by(Transaccion.fecha.desc())
        .limit(5)
        .all()
    )

    return {
        "patrimonio"           : round(patrimonio, 2),
        "deuda_tarjeta"        : round(deuda_tarjeta, 2),
        "rendimientos"         : rendimientos_totales,
        "ultimas_transacciones": [
            {
                "id"         : tx.id,
                "descripcion": tx.descripcion,
                "monto"      : tx.monto,
                "fecha"      : tx.fecha,
                "cuenta"     : tx.cuenta.nombre,
                "categoria"  : tx.categoria.nombre if tx.categoria else None,
            }
            for tx in ultimas_tx
        ],
    }
