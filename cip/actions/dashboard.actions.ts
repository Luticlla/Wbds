"use server"

import { createAuthClient } from "@/lib/supabase/auth-server"
import { createClient } from "@/lib/supabase/server"
import { subirArchivo } from "@/lib/supabase/storage"

export async function actualizarDocumentoDashboard(
  solicitanteId: string,
  tipo: "foto" | "titulo" | "dni",
  base64: string,
) {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "No autenticado" }

  const { data: solicitante } = await supabase
    .from("solicitantes")
    .select("id, dni")
    .eq("id", solicitanteId)
    .eq("auth_user_id", user.id)
    .single()

  if (!solicitante) return { error: "Solicitante no encontrado" }

  const { data: expediente } = await supabase
    .from("expedientes")
    .select("id, estado")
    .eq("solicitante_id", solicitanteId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!expediente) return { error: "Expediente no encontrado" }

  if (expediente.estado !== "Rechazado") {
    return { error: "Solo puedes cambiar documentos cuando tu expediente está Rechazado" }
  }

  const folder = `solicitudes/${solicitante.dni}`
  const filename = `${tipo}.png`

  const url = await subirArchivo("expedientes", `${folder}/${filename}`, base64)

  if (!url) return { error: "Error al subir el archivo" }

  const colMap: Record<string, string> = {
    foto: "foto_url",
    titulo: "titulo_url",
    dni: "dni_url",
  }

  const { error: errUpdate } = await supabase
    .from("solicitantes")
    .update({ [colMap[tipo]]: url })
    .eq("id", solicitanteId)

  if (errUpdate) return { error: errUpdate.message }

  return { success: true, newUrl: url }
}

export async function enviarParaRevisionDashboard(solicitanteId: string) {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "No autenticado" }

  const { data: solicitante } = await supabase
    .from("solicitantes")
    .select("id")
    .eq("id", solicitanteId)
    .eq("auth_user_id", user.id)
    .single()

  if (!solicitante) return { error: "Solicitante no encontrado" }

  const serverClient = createClient()
  const { data: expediente } = await serverClient
    .from("expedientes")
    .select("id, estado")
    .eq("solicitante_id", solicitanteId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!expediente) return { error: "Expediente no encontrado" }

  if (expediente.estado !== "Rechazado") {
    return { error: "El expediente no está en estado Rechazado" }
  }

  const { error: errInsert } = await serverClient
    .from("expedientes")
    .insert({ solicitante_id: solicitanteId, estado: "Pendiente" })

  if (errInsert) return { error: errInsert.message }

  return { success: true }
}

export async function realizarPagoDashboard(solicitanteId: string, voucherBase64: string) {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "No autenticado" }

  const { data: solicitante } = await supabase
    .from("solicitantes")
    .select("id, dni")
    .eq("id", solicitanteId)
    .eq("auth_user_id", user.id)
    .single()

  if (!solicitante) return { error: "Solicitante no encontrado" }

  const serverClient = createClient()
  const { data: expediente } = await serverClient
    .from("expedientes")
    .select("id, estado")
    .eq("solicitante_id", solicitanteId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!expediente) return { error: "Expediente no encontrado" }

  if (expediente.estado !== "Pendiente de pago") {
    return { error: "El expediente no está pendiente de pago" }
  }

  const transaccionId = "TXN-" + Date.now().toString(36).toUpperCase()
  const folder = `solicitudes/${solicitante.dni}`
  const voucherUrl = await subirArchivo("expedientes", `${folder}/voucher.png`, voucherBase64)

  if (!voucherUrl) return { error: "Error al subir el comprobante" }

  const { error: errPago } = await serverClient.from("pagos_inscripcion").insert({
    expediente_id: expediente.id,
    tipo_pago: "Virtual",
    monto: 1500,
    estado: "Pendiente",
    transaccion_id: transaccionId,
    comprobante_url: voucherUrl,
  })

  if (errPago) return { error: errPago.message }

  return { success: true }
}
