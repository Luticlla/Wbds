"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { adminMarcarMensualidadPagada } from "@/actions/pago-mensual.actions"
import { nombreMes } from "@/lib/constants"
import { Button } from "@/components/ui/Button"
import { Alert } from "@/components/ui/Alert"
import { Badge } from "@/components/ui/Badge"
import { BoletaReceipt } from "./BoletaReceipt"

interface PagoMensual {
  id: string
  anio: number
  mes: number
  monto: number
  estado: string
  fecha_pago: string | null
  created_at: string
}

interface Props {
  expedienteId: string
  colegiadoId: string
  numeroCip: string
  nombres: string
  apellidoPaterno: string
  apellidoMaterno: string
  dni: string
  pagos: PagoMensual[]
}

const estadoBadge: Record<string, "success" | "warning" | "neutral"> = {
  Pagado: "success",
  Pendiente: "warning",
}

export function AdminPagoMensualSection({
  expedienteId,
  colegiadoId,
  numeroCip,
  nombres,
  apellidoPaterno,
  apellidoMaterno,
  dni,
  pagos,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [resultado, setResultado] = useState<{
    pagos: { anio: number; mes: number; monto: number }[]
    totalMonto: number
    fechaPago: string
  } | null>(null)

  const pendientes = pagos.filter((p) => p.estado === "Pendiente")
  const tienePendientes = pendientes.length > 0

  async function handleMarcarPagado() {
    setLoading(true)
    setError("")

    const res = await adminMarcarMensualidadPagada(expedienteId)

    if (res.error) {
      setError(res.error)
      setLoading(false)
      return
    }

    if (res.success && res.data) {
      setResultado({
        pagos: res.data.pagos.map((p) => ({ anio: p.anio, mes: p.mes, monto: p.monto })),
        totalMonto: res.data.totalMonto,
        fechaPago: res.data.pagos[0]?.fecha_pago ?? new Date().toISOString(),
      })
    }

    setLoading(false)
    router.refresh()
  }

  if (resultado) {
    return (
      <section className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-green-700">✅ Pago registrado exitosamente</h2>
        <BoletaReceipt
          numeroCip={numeroCip}
          nombres={nombres}
          apellidoPaterno={apellidoPaterno}
          apellidoMaterno={apellidoMaterno}
          dni={dni}
          pagos={resultado.pagos}
          totalMonto={resultado.totalMonto}
          fechaPago={resultado.fechaPago}
          onClose={() => setResultado(null)}
        />
      </section>
    )
  }

  return (
    <section className="rounded-lg border bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-800">💳 Pagos Mensuales</h2>

      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
              <th className="pb-2 pr-4 font-medium">Período</th>
              <th className="pb-2 pr-4 font-medium">Monto</th>
              <th className="pb-2 pr-4 font-medium">Estado</th>
              <th className="pb-2 pr-4 font-medium">Fecha de pago</th>
            </tr>
          </thead>
          <tbody>
            {pagos.map((p) => (
              <tr key={p.id} className="border-b border-gray-100">
                <td className="py-2 pr-4 text-gray-800">
                  {nombreMes(p.mes)} {p.anio}
                </td>
                <td className="py-2 pr-4 text-gray-800">S/ {Number(p.monto).toFixed(2)}</td>
                <td className="py-2 pr-4">
                  <Badge variant={estadoBadge[p.estado] ?? "neutral"}>{p.estado}</Badge>
                </td>
                <td className="py-2 pr-4 text-gray-500">
                  {p.fecha_pago
                    ? new Date(p.fecha_pago).toLocaleDateString("es-PE")
                    : "-"}
                </td>
              </tr>
            ))}
            {pagos.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-gray-400">
                  No hay pagos mensuales registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {tienePendientes && (
        <div className="mt-4">
          <p className="mb-2 text-sm text-gray-600">
            {pendientes.length} mes(es) pendiente(s) — Total: S/{" "}
            {pendientes.reduce((s, p) => s + Number(p.monto), 0).toFixed(2)}
          </p>
          <Button
            variant="primary"
            disabled={loading}
            onClick={handleMarcarPagado}
          >
            {loading ? "Registrando..." : `Marcar todo como Pagado`}
          </Button>
        </div>
      )}
    </section>
  )
}
