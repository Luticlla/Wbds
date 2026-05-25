import { createAuthClient } from "@/lib/supabase/auth-server"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/Badge"
import { Alert } from "@/components/ui/Alert"
import { ESTADO_BADGE, formatDate, parsearObservaciones } from "@/lib/constants"
import { listarNotificaciones } from "@/actions/notificaciones.actions"
import { NotificacionesSection } from "./NotificacionesSection"
import { CorregirExpediente } from "./CorregirExpediente"
import { PagoForm } from "./PagoForm"
import Link from "next/link"

const ORDEN_ESTADOS = ["Pendiente", "Pendiente de pago", "Aprobado"]

const MAPA_CAMPOS_LABEL: Record<string, string> = {
  identidad: "Identidad",
  formacion: "Formación",
  foto: "Foto", titulo: "Título",
  dni_file: "Copia DNI",
}

function RevisionBadge({ valido, label }: { valido: boolean; label: string }) {
  return (
    <div className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-medium ${
      valido
        ? "border-green-200 bg-green-50 text-green-700"
        : "border-red-200 bg-red-50 text-red-700"
    }`}>
      <span>{valido ? "✅" : "❌"}</span>
      <span>{label}</span>
    </div>
  )
}

function RevisionDetalle({ observaciones }: { observaciones: string }) {
  const { comentario, campos } = parsearObservaciones(observaciones)
  if (!campos) return null
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium text-gray-600">Detalle de revisión:</p>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(campos).map(([key, valido]) => (
          <RevisionBadge key={key} valido={!!valido} label={MAPA_CAMPOS_LABEL[key] ?? key} />
        ))}
      </div>
      {comentario && (
        <p className="mt-2 text-xs text-gray-600 italic">"{comentario}"</p>
      )}
    </div>
  )
}

function Timeline({ estadoActual, fechaCreacion, historial }: {
  estadoActual: string
  fechaCreacion: string
  historial: { estado_nuevo: string; created_at: string; comentario: string | null }[]
}) {
  const idxActual = ORDEN_ESTADOS.indexOf(estadoActual)
  if (idxActual === -1) return null

  return (
    <div className="space-y-0">
      {ORDEN_ESTADOS.map((estado, idx) => {
        const completado = idx <= idxActual
        const esActual = idx === idxActual

        let fecha: string | null = null
        if (estado === "Pendiente") {
          fecha = fechaCreacion
        } else {
          const paso = historial.find((h) => h.estado_nuevo === estado)
          if (paso) fecha = paso.created_at
        }

        return (
          <div key={estado} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  completado ? "bg-green-500 text-white" : "bg-gray-200 text-gray-400"
                }`}
              >
                {completado ? "✓" : idx + 1}
              </div>
              {idx < ORDEN_ESTADOS.length - 1 && (
                <div className={`h-8 w-0.5 ${completado && idx < idxActual ? "bg-green-400" : "bg-gray-200"}`} />
              )}
            </div>
            <div className={`pb-6 ${esActual ? "" : ""}`}>
              <p className={`text-sm font-medium ${completado ? "text-gray-900" : "text-gray-400"}`}>{estado}</p>
              {fecha && <p className="text-xs text-gray-500">{formatDate(fecha)}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default async function UserDashboardPage() {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <p className="text-center text-gray-500">No autenticado</p>

  const serverClient = createClient()
  const { data: solicitante } = await serverClient
    .from("solicitantes")
    .select("id, dni, nombres, apellido_paterno, apellido_materno, correo, universidad, carrera_manual, sede_id, foto_url, titulo_url, dni_url")
    .eq("auth_user_id", user.id)
    .single()

  if (!solicitante) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <Alert variant="warning" title="Solicitud no encontrada">
          No encontramos una solicitud de colegiatura vinculada a tu cuenta. Si ya realizaste el registro, contacta con soporte.
        </Alert>
      </div>
    )
  }

  const [sedes, expedienteData, notifsData] = await Promise.all([
    serverClient.from("sedes").select("id, nombre"),
    serverClient.from("expedientes").select("id, codigo_expediente, estado, observaciones, fecha_revision, created_at").eq("solicitante_id", solicitante.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    listarNotificaciones(),
  ])

  const sede = sedes.data?.find((s) => s.id === solicitante.sede_id)
  const expediente = expedienteData.data
  const notificaciones = notifsData.data ?? []

  let historial: { estado_nuevo: string; created_at: string; comentario: string | null }[] = []
  let pago = null
  let colegiado = null

  if (expediente) {
    const [histData, pagoData, colData] = await Promise.all([
      serverClient.from("historial_estados_expediente").select("estado_nuevo, comentario, created_at").eq("expediente_id", expediente.id).order("created_at", { ascending: true }),
      serverClient.from("pagos_inscripcion").select("id, monto, estado, tipo_pago, comprobante_url").eq("expediente_id", expediente.id).limit(1).single(),
      serverClient.from("colegiados").select("id, numero_cip, estado_habilitacion, fecha_colegiatura").eq("expediente_id", expediente.id).single(),
    ])

    historial = histData.data ?? []
    pago = pagoData.data
    colegiado = colData.data
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Bienvenido, {solicitante.nombres.split(" ")[0]}
          </h1>
          <p className="text-sm text-gray-500">Dashboard de seguimiento de colegiatura</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-6 md:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">📋 Mis Datos</h2>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div><span className="font-medium text-gray-500">DNI:</span> <span className="text-gray-800">{solicitante.dni}</span></div>
            <div><span className="font-medium text-gray-500">Nombre:</span> <span className="text-gray-800">{solicitante.nombres} {solicitante.apellido_paterno} {solicitante.apellido_materno}</span></div>
            <div><span className="font-medium text-gray-500">Correo:</span> <span className="text-gray-800">{solicitante.correo}</span></div>
            <div><span className="font-medium text-gray-500">Universidad:</span> <span className="text-gray-800">{solicitante.universidad}</span></div>
            <div><span className="font-medium text-gray-500">Carrera:</span> <span className="text-gray-800">{solicitante.carrera_manual || "-"}</span></div>
            <div><span className="font-medium text-gray-500">Sede:</span> <span className="text-gray-800">{sede?.nombre}</span></div>
          </div>
          <div className="mt-4">
            <Link href="/micuenta/datos" className="text-sm font-medium text-blue-700 hover:text-blue-900">
              Editar datos →
            </Link>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">🔔 Notificaciones</h2>
          <NotificacionesSection initial={notificaciones} />
        </div>
      </div>

      {expediente ? (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-lg border bg-white p-6 md:col-span-2">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">📌 Estado del Trámite</h2>
            <div className="mb-4 flex items-center gap-3">
              <span className="font-mono text-lg font-bold text-gray-800">{expediente.codigo_expediente}</span>
              <Badge variant={ESTADO_BADGE[expediente.estado] ?? "neutral"}>{expediente.estado}</Badge>
            </div>

            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div><span className="font-medium text-gray-500">Registro:</span> <span className="text-gray-800">{formatDate(expediente.created_at)}</span></div>
              {expediente.fecha_revision && (
                <div><span className="font-medium text-gray-500">Revisión:</span> <span className="text-gray-800">{formatDate(expediente.fecha_revision)}</span></div>
              )}
            </div>

            {expediente.observaciones && (
              <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                <span className="font-medium">📝 Observación:</span>
                <p className="mt-1 whitespace-pre-wrap">{parsearObservaciones(expediente.observaciones).comentario}</p>
                <RevisionDetalle observaciones={expediente.observaciones} />
              </div>
            )}

            <div className="mt-6">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Línea de tiempo</h3>
              <Timeline estadoActual={expediente.estado} fechaCreacion={expediente.created_at} historial={historial} />
            </div>
          </div>

          <div className="space-y-4">
            {pago && (
              <div className="rounded-lg border bg-white p-6">
                <h3 className="mb-3 text-sm font-semibold text-gray-700">💳 Pago de Inscripción</h3>
                <p className="text-sm"><span className="font-medium text-gray-500">Monto:</span> S/ {pago.monto.toFixed(2)}</p>
                <p className="text-sm"><span className="font-medium text-gray-500">Estado:</span> {pago.estado}</p>
              </div>
            )}

            {colegiado && (
              <div className="rounded-lg border bg-white p-6">
                <h3 className="mb-3 text-sm font-semibold text-gray-700">🪪 Colegiatura</h3>
                <p className="text-sm"><span className="font-medium text-gray-500">CIP:</span> <span className="font-mono font-bold">{colegiado.numero_cip}</span></p>
                <p className="text-sm">
                  <span className="font-medium text-gray-500">Estado:</span>{" "}
                  {colegiado.estado_habilitacion === "Habilitado" ? (
                    <span className="text-green-600">✅ Habilitado</span>
                  ) : (
                    <span className="text-red-600">❌ Inhabilitado</span>
                  )}
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  <Link href={`/carnet/${solicitante.dni}`} className="text-sm font-medium text-blue-700 hover:text-blue-900">
                    Ver carnet digital →
                  </Link>
                  <Link href="/micuenta/pagos" className="text-sm font-medium text-blue-700 hover:text-blue-900">
                    Ir a pagos mensuales →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {expediente?.estado === "Pendiente de pago" && (
            <div className="md:col-span-3">
              <div className="rounded-lg border bg-white p-6">
                <h2 className="mb-4 text-lg font-semibold text-gray-800">💳 Pago de Inscripción</h2>
                <PagoForm expedienteId={expediente.id} />
              </div>
            </div>
          )}

          {expediente?.estado === "Rechazado" && (
            <div className="md:col-span-3">
              <CorregirExpediente
                solicitanteId={solicitante.id}
                fotoUrl={solicitante.foto_url}
                tituloUrl={solicitante.titulo_url}
                dniUrl={solicitante.dni_url}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          No se encontró un expediente asociado a tu registro.
        </div>
      )}
    </div>
  )
}
