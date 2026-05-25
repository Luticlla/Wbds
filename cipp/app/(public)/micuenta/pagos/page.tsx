import { CheckCircle, XCircle, CalendarClock, History } from "lucide-react"
import { createAuthClient } from "@/lib/supabase/auth-server"
import { createClient } from "@/lib/supabase/server"
import { obtenerDeuda, listarPagosMensuales } from "@/actions/pago-mensual.actions"
import { PagoMensualMP } from "./PagoMensualMP"
import { Badge } from "@/components/ui/Badge"
import { Alert } from "@/components/ui/Alert"
import { formatDate, nombreMes } from "@/lib/constants"

const ESTADO_BADGE_PAGO: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  Pagado: "success",
  Pendiente: "warning",
  Vencido: "danger",
}

export default async function PagosPage() {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <p className="text-center text-gray-500">No autenticado</p>

  const serverClient = createClient()
  const { data: solicitante } = await serverClient
    .from("solicitantes")
    .select("id, dni")
    .eq("auth_user_id", user.id)
    .single()

  if (!solicitante) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <Alert variant="warning" title="Sin datos">No se encontraron tus datos.</Alert>
      </div>
    )
  }

  const deudaResult = await obtenerDeuda()
  const pagosResult = await listarPagosMensuales()

  const noEsColegiado = "error" in deudaResult && deudaResult.error?.includes("Aún no eres colegiado")

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Mis Pagos Mensuales</h1>

      {noEsColegiado ? (
        <Alert variant="info" title="Aún no eres colegiado">
          Los pagos mensuales estarán disponibles una vez que tu expediente sea aprobado y recibas tu número CIP.
        </Alert>
      ) : "data" in deudaResult && deudaResult.data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-white p-6 text-center">
              <p className="text-sm font-medium text-gray-500">Estado</p>
              <p className={`mt-1 text-lg font-bold ${deudaResult.data.estadoHabilitacion === "Habilitado" ? "text-green-600" : "text-red-600"}`}>
                {deudaResult.data.estadoHabilitacion === "Habilitado" ? (
                  <><CheckCircle className="inline h-5 w-5 text-green-600" /> Habilitado</>
                ) : (
                  <><XCircle className="inline h-5 w-5 text-red-600" /> Inhabilitado</>
                )}
              </p>
            </div>
            <div className="rounded-lg border bg-white p-6 text-center">
              <p className="text-sm font-medium text-gray-500">Meses adeudados</p>
              <p className="mt-1 text-lg font-bold text-gray-800">{deudaResult.data.mesesAdeudados.length}</p>
            </div>
            <div className="rounded-lg border bg-white p-6 text-center">
              <p className="text-sm font-medium text-gray-500">Total deuda</p>
              <p className="mt-1 text-lg font-bold text-red-600">S/ {deudaResult.data.totalDeuda.toFixed(2)}</p>
            </div>
          </div>

          {deudaResult.data.mesesAdeudados.length > 0 && (
            <div className="rounded-lg border bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-800"><CalendarClock className="mr-1 inline h-5 w-5" />Meses pendientes</h2>
              <div className="divide-y divide-gray-100">
                {deudaResult.data.mesesAdeudados.map((m) => (
                  <div key={`${m.anio}-${m.mes}`} className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-700">
                      {nombreMes(m.mes)} {m.anio}
                    </span>
                    <span className="text-sm font-medium text-red-600">S/ 20.00</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-gray-200 pt-4">
                <PagoMensualMP
                  colegiadoId={deudaResult.data.colegiadoId}
                  total={deudaResult.data.totalDeuda}
                  meses={deudaResult.data.mesesAdeudados}
                />
              </div>
            </div>
          )}

          {pagosResult.data && pagosResult.data.length > 0 && (
            <div className="rounded-lg border bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-800"><History className="mr-1 inline h-5 w-5" />Historial de pagos</h2>
              <div className="divide-y divide-gray-100">
                {pagosResult.data.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">{nombreMes(p.mes)} {p.anio}</span>
                      <span className="ml-2 text-gray-500">- S/ {Number(p.monto).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">{p.created_at ? formatDate(p.created_at) : ""}</span>
                      <Badge variant={ESTADO_BADGE_PAGO[p.estado] ?? "neutral"}>{p.estado}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {deudaResult.data.mesesAdeudados.length === 0 && (
            <Alert variant="success" title="¡Al día!">
              No tienes deudas pendientes. Todos tus pagos mensuales están al corriente.
            </Alert>
          )}
        </>
      ) : (
        <Alert variant="error" title="Error">
          {"error" in deudaResult ? deudaResult.error : "Error al cargar datos"}
        </Alert>
      )}
    </div>
  )
}
