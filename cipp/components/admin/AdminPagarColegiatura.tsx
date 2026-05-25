"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { adminPagarColegiatura } from "@/actions/expediente.actions"
import { Button } from "@/components/ui/Button"
import { Alert } from "@/components/ui/Alert"
import { BoletaReceipt } from "./BoletaReceipt"

interface Props {
  expedienteId: string
  nombres: string
  apellidoPaterno: string
  apellidoMaterno: string
  dni: string
}

export function AdminPagarColegiatura({ expedienteId, nombres, apellidoPaterno, apellidoMaterno, dni }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState<{ cip: string } | null>(null)

  async function handlePagar() {
    setLoading(true)
    setError("")

    const res = await adminPagarColegiatura(expedienteId)

    if (res.error) {
      setError(res.error)
      setLoading(false)
      return
    }

    setSuccess({ cip: res.cip ?? "" })
    setLoading(false)
    router.refresh()
  }

  if (success) {
    return (
      <BoletaReceipt
        numeroCip={success.cip}
        nombres={nombres}
        apellidoPaterno={apellidoPaterno}
        apellidoMaterno={apellidoMaterno}
        dni={dni}
        pagos={[]}
        totalMonto={1500}
        fechaPago={new Date().toISOString()}
        concepto="Pago de colegiatura CIP - Inscripción"
        onClose={() => router.push("/admin/expedientes")}
      />
    )
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}

      <p className="text-sm text-amber-700">
        ⏳ El usuario aún no ha realizado el pago de inscripción. Puedes registrar el pago
        presencialmente desde aquí.
      </p>

      <Button
        variant="primary"
        disabled={loading}
        onClick={handlePagar}
      >
        {loading ? "Procesando..." : "💰 Pagar Colegiatura (Admin)"}
      </Button>
    </div>
  )
}
