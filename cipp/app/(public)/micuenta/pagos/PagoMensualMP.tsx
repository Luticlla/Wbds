"use client"

import { useState } from "react"
import { mpCrearPreferenciaMensual } from "@/actions/pago-mensual.actions"
import { Button } from "@/components/ui/Button"
import { Alert } from "@/components/ui/Alert"
import { nombreMes } from "@/lib/constants"

interface Props {
  colegiadoId: string
  total: number
  meses: { anio: number; mes: number }[]
}

export function PagoMensualMP({ colegiadoId, total, meses }: Props) {
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState("")

  async function handlePagar() {
    setCreando(true)
    setError("")

    try {
      const res = await mpCrearPreferenciaMensual(colegiadoId, total)

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

  return (
    <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-6">
      <h3 className="mb-2 text-lg font-semibold text-blue-800">Pagar todo junto</h3>
      <p className="mb-3 text-sm text-blue-700">
        {meses.map((m) => nombreMes(m.mes) + " " + m.anio).join(", ")}
      </p>

      <div className="mb-4 rounded-lg border border-blue-200 bg-white p-4 text-center">
        <p className="text-sm text-gray-500">Total a pagar</p>
        <p className="text-3xl font-bold text-gray-900">S/ {total.toFixed(2)}</p>
      </div>

      <Button
        className="w-full"
        size="lg"
        loading={creando}
        onClick={handlePagar}
      >
        {creando ? "Conectando con Mercado Pago..." : `Pagar S/ ${total.toFixed(2)} con Mercado Pago`}
      </Button>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
