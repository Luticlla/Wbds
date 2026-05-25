import { Suspense } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { obtenerDetalleExpediente } from "@/actions/expediente.actions"
import { Badge } from "@/components/ui/Badge"
import { ESTADO_BADGE, formatDate, parsearObservaciones } from "@/lib/constants"
import { ExpedienteActions } from "./ExpedienteActions"
import { ConfirmarPagoActions } from "./ConfirmarPagoActions"
import { DocumentPreview } from "@/components/ui/DocumentPreview"
import { AdminPagoMensualSection } from "@/components/admin/AdminPagoMensualSection"

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex border-b border-gray-100 py-2 text-sm">
      <span className="w-40 font-medium text-gray-500">{label}</span>
      <span className="text-gray-800">{value}</span>
    </div>
  )
}

function RevisionBadge({ valido, label }: { valido: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${
      valido
        ? "border-green-200 bg-green-50 text-green-700"
        : "border-red-200 bg-red-50 text-red-700"
    }`}>
      <span>{valido ? "✅" : "❌"}</span>
      <span>{label}</span>
    </div>
  )
}

interface PageProps {
  params: Promise<{ id: string }>
}

async function ExpedienteContent({ id }: { id: string }) {
  const supabase = createClient()
  const detalle = await obtenerDetalleExpediente(id)

  if (!detalle) {
    return (
      <p className="py-12 text-center text-gray-500">
        Expediente no encontrado
      </p>
    )
  }

  const { data: sedes } = await supabase.from("sedes").select("id, nombre")

  const s = detalle.solicitantes
  const sede = sedes?.find((sed) => sed.id === s.sede_id)
  const pago = detalle.pagos_inscripcion?.[0]

  function ResultadoRevision({ observaciones }: { observaciones: string }) {
    const { comentario, campos } = parsearObservaciones(observaciones)
    if (!campos) {
      return (
        <section className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">📝 Observaciones</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{comentario}</p>
        </section>
      )
    }
    return (
      <section className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">📝 Resultado de Revisión</h2>
        {comentario && (
          <p className="mb-4 text-sm text-gray-700 whitespace-pre-wrap">{comentario}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {Object.entries(campos).map(([key, valido]) => (
            <RevisionBadge key={key} valido={!!valido} label={
              ({ identidad: "Identidad", formacion: "Formación", foto: "Foto", titulo: "Título", dni_file: "Copia DNI" } as Record<string, string>)[key] ?? key
            } />
          ))}
        </div>
      </section>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back + header */}
      <div className="flex items-center justify-between">
        <Link href="/admin/expedientes" className="text-sm text-blue-600 hover:text-blue-800">
          ← Volver a bandeja
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-gray-800">{detalle.codigo_expediente}</span>
          <Badge variant={ESTADO_BADGE[detalle.estado] ?? "neutral"}>{detalle.estado}</Badge>
        </div>
      </div>

      {/* Datos del solicitante */}
      <section className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">📋 Datos del Solicitante</h2>
        <InfoRow label="DNI" value={s.dni} />
        <InfoRow label="Apellido Paterno" value={s.apellido_paterno} />
        <InfoRow label="Apellido Materno" value={s.apellido_materno} />
        <InfoRow label="Nombres" value={s.nombres} />
        <InfoRow label="Correo" value={s.correo ?? "-"} />
        <InfoRow label="Teléfono" value={s.telefono ?? "-"} />
        <InfoRow label="Universidad" value={s.universidad} />
        <InfoRow label="Carrera" value={s.carrera_manual ?? "-"} />
        <InfoRow label="Sede" value={sede?.nombre ?? "-"} />
        <InfoRow label="Validado RENIEC" value={s.validado_reniec ? "✅ Sí" : "❌ No"} />
      </section>

      {/* Documentos */}
      <section className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">📄 Documentos</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {s.foto_url && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500">Foto</p>
              <DocumentPreview url={s.foto_url} label="Foto" thumbnail />
            </div>
          )}
          {s.titulo_url && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500">Título</p>
              <DocumentPreview url={s.titulo_url} label="Título" thumbnail />
            </div>
          )}
          {s.dni_url && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500">Copia DNI</p>
              <DocumentPreview url={s.dni_url} label="Copia DNI" thumbnail />
            </div>
          )}
          {pago?.comprobante_url && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500">Voucher</p>
              <DocumentPreview url={pago.comprobante_url} label="Voucher" thumbnail />
            </div>
          )}
        </div>
      </section>

      {/* Pago */}
      {pago && (
        <section className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">💳 Pago de Inscripción</h2>
          <InfoRow label="Monto" value={`S/ ${pago.monto.toFixed(2)}`} />
          <InfoRow label="Estado" value={pago.estado} />
          <InfoRow label="Tipo" value={pago.tipo_pago} />
          <InfoRow label="N° Operación" value={pago.transaccion_id ?? "-"} />

          {detalle.estado === "Pendiente de pago" && pago.comprobante_url && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-gray-700">Voucher de pago:</p>
              <DocumentPreview url={pago.comprobante_url} label="Voucher de pago" thumbnail />
            </div>
          )}
        </section>
      )}

      {/* Pagos Mensuales (solo si es colegiado) */}
      {detalle.colegiado && (
        <AdminPagoMensualSection
          expedienteId={detalle.id}
          colegiadoId={detalle.colegiado.id}
          numeroCip={detalle.colegiado.numero_cip}
          nombres={s.nombres}
          apellidoPaterno={s.apellido_paterno}
          apellidoMaterno={s.apellido_materno}
          dni={s.dni}
          pagos={detalle.pagos_mensualidades}
        />
      )}

      {/* Resultados de revisión */}
      {detalle.observaciones && (
        <ResultadoRevision observaciones={detalle.observaciones} />
      )}

      {/* Fecha */}
      <section className="rounded-lg border bg-white p-6">
        <InfoRow label="Fecha de registro" value={formatDate(detalle.created_at)} />
        {detalle.fecha_revision && (
          <InfoRow label="Fecha de revisión" value={formatDate(detalle.fecha_revision)} />
        )}
      </section>

      {/* Acciones */}
      {detalle.estado === "Pendiente de pago" ? (
        <section className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">⚡ Revisión de Pago</h2>
          <ConfirmarPagoActions expedienteId={detalle.id} />
        </section>
      ) : detalle.estado === "Pendiente" && (
        <section className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">⚡ Acciones</h2>
          <ExpedienteActions expedienteId={detalle.id} estado={detalle.estado} />
        </section>
      )}
    </div>
  )
}

export default async function ExpedienteDetailPage({ params }: PageProps) {
  const { id } = await params
  return (
    <Suspense fallback={<p className="py-12 text-center text-gray-500">Cargando expediente...</p>}>
      <ExpedienteContent id={id} />
    </Suspense>
  )
}
