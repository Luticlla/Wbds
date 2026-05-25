"use client"

import { useState } from "react"
import { mpCrearPreferencia } from "@/actions/pago.actions"
import { Button } from "@/components/ui/Button"
import { Alert } from "@/components/ui/Alert"

interface Props {
  expedienteId: string
}

function leerPagoSession(): { pagado: boolean; paymentId: string | null } {
  if (typeof window === "undefined") return { pagado: false, paymentId: null }
  try {
    const raw = sessionStorage.getItem("mp_pago_cip")
    if (raw) {
      const data = JSON.parse(raw)
      sessionStorage.removeItem("mp_pago_cip")
      if (data.status === "approved") {
        return { pagado: true, paymentId: data.paymentId ?? null }
      }
    }
  } catch {}
  return { pagado: false, paymentId: null }
}

export function PagoForm({ expedienteId }: Props) {
  const [creando, setCreando] = useState(false)
  const [{ pagado, paymentId }] = useState(leerPagoSession)
  const [error, setError] = useState("")

  async function handlePagar() {
    setCreando(true)
    setError("")

    try {
      const res = await mpCrearPreferencia({
        monto: 2,
        titulo: "Colegiado Ingenieros Peru",
        externalReference: `EXP-${expedienteId}`,
      })

      if (!res.ok) {
        setError(res.error)
        return
      }

      window.location.href = res.initPoint
    } catch {
      setError("Error al conectar con Mercado Pago")
    } finally {
      setCreando(false)
    }
  }

  if (pagado) {
    return (
      <Alert variant="success" title="Pago exitoso">
        <p>Tu pago ha sido procesado correctamente.</p>
        <p className="mt-1">
          Operación: <strong>{paymentId}</strong>
        </p>
        <p className="mt-1 text-sm">Actualizando datos...</p>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <Alert variant="info" title="Pago de inscripción">
        <p>El derecho de inscripción es de <strong>S/ 1,500.00</strong>.</p>
        <p className="mt-1">Primer mes de colegiatura <strong>GRATIS</strong>.</p>
      </Alert>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-500">Monto a pagar</p>
        <p className="text-4xl font-bold text-gray-900">S/ 1,500.00</p>
      </div>

      <Button
        className="w-full"
        size="lg"
        loading={creando}
        onClick={handlePagar}
      >
        {creando ? "Conectando con Mercado Pago..." : "Pagar con Mercado Pago"}
      </Button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
