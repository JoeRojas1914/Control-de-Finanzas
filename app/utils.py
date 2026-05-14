from datetime import datetime

def resumen_rendimientos(rendimientos: list) -> dict:
    hoy        = datetime.now().date()
    inicio_mes = hoy.replace(day=1)

    diario  = sum(r.monto for r in rendimientos if r.fecha.date() == hoy)
    mensual = sum(r.monto for r in rendimientos if r.fecha.date() >= inicio_mes)
    anual   = sum(r.monto for r in rendimientos)

    return {
        "diario":  round(diario,  2),
        "mensual": round(mensual, 2),
        "anual":   round(anual,   2),
    }