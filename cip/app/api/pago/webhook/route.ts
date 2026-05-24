import { NextRequest, NextResponse } from "next/server"
import { verificarPago } from "@/lib/pago/mercadopago"
import { createClient } from "@/lib/supabase/server"
import { autoAprobarColegiatura } from "@/actions/expediente.actions"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const paymentId = body.data?.id || body.id

    if (!paymentId) {
      console.log("[MP Webhook] No paymentId en body:", body)
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const pago = await verificarPago(String(paymentId))

    console.log("[MP Webhook] Pago recibido:", {
      id: pago.id,
      status: pago.status,
      externalReference: pago.externalReference,
    })

    if (pago.externalReference) {
      const supabase = createClient()
      const externalRef = pago.externalReference

      const expedienteId = externalRef.startsWith("EXP-")
        ? externalRef.replace("EXP-", "")
        : externalRef

      const estadoMapping: Record<string, string> = {
        approved: "Aprobado",
        rejected: "Rechazado",
        cancelled: "Rechazado",
        refunded: "Rechazado",
        in_process: "Pendiente",
        pending: "Pendiente",
      }

      const estado = estadoMapping[pago.status ?? ""] || "Pendiente"

      const { data: existingPago } = await supabase
        .from("pagos_inscripcion")
        .select("id, estado")
        .eq("expediente_id", expedienteId)
        .maybeSingle()

      if (existingPago) {
        const { error: err } = await supabase
          .from("pagos_inscripcion")
          .update({
            estado,
            transaccion_id: `MP-${pago.id}`,
          })
          .eq("id", existingPago.id)

        if (err) {
          console.warn("[MP Webhook] Error al actualizar pago:", err.message)
        } else {
          console.log("[MP Webhook] Pago actualizado a", estado)
        }

        if (estado === "Aprobado" && existingPago.estado !== "Aprobado") {
          console.log("[MP Webhook] Ejecutando auto-aprobación...")
          await autoAprobarColegiatura(expedienteId, `MP-${pago.id}`, supabase)
        }
      } else {
        const { error: errInsert } = await supabase.from("pagos_inscripcion").insert({
          expediente_id: expedienteId,
          tipo_pago: "Virtual",
          monto: 1500,
          estado,
          transaccion_id: `MP-${pago.id}`,
        })

        if (errInsert) {
          console.warn("[MP Webhook] Error al insertar pago:", errInsert.message)
        } else {
          console.log("[MP Webhook] Pago insertado con estado", estado)
        }

        if (estado === "Aprobado") {
          console.log("[MP Webhook] Ejecutando auto-aprobación...")
          await autoAprobarColegiatura(expedienteId, `MP-${pago.id}`, supabase)
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[MP Webhook] Error:", error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
