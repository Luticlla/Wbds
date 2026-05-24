"use server"

import { createClient } from "@/lib/supabase/server"
import { requireAdminRole } from "@/lib/auth-helper"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { formatearDetalleCampos, serializarObservaciones, type RevisionCampos } from "@/lib/constants"

async function crearNotificacion(supabase: ReturnType<typeof createClient>, expedienteId: string, tipo: string, titulo: string, mensaje: string, campos?: RevisionCampos) {
  const { data: exp } = await supabase
    .from("expedientes")
    .select("solicitante_id")
    .eq("id", expedienteId)
    .single()

  if (!exp) return

  const payload = campos ? JSON.stringify({ texto: mensaje, campos }) : mensaje

  await supabase.from("notificaciones").insert({
    solicitante_id: exp.solicitante_id,
    tipo,
    titulo,
    mensaje: payload,
  })
}

export interface FiltrosExpedientes {
  estado?: string
  busqueda?: string
}

export async function listarExpedientes(filtros: FiltrosExpedientes = {}) {
  const supabase = createClient()

  let query = supabase
    .from("expedientes")
    .select(`
      id,
      codigo_expediente,
      estado,
      observaciones,
      fecha_revision,
      created_at,
      solicitantes!expedientes_solicitante_id_fkey (
        id,
        dni,
        nombres,
        apellido_paterno,
        apellido_materno
      )
    `)
    .order("created_at", { ascending: false })

  if (filtros.estado) {
    query = query.eq("estado", filtros.estado)
  }

  if (filtros.busqueda) {
    const busqueda = filtros.busqueda
    const { data: ids } = await supabase
      .from("solicitantes")
      .select("id")
      .or(
        `dni.ilike.%${busqueda}%,nombres.ilike.%${busqueda}%,apellido_paterno.ilike.%${busqueda}%,apellido_materno.ilike.%${busqueda}%`,
      )

    if (ids && ids.length > 0) {
      query = query.in("solicitante_id", ids.map((r) => r.id))
    } else {
      return { data: [] }
    }
  }

  const { data, error } = await query

  if (error) {
    console.error("Error al listar expedientes:", error.message)
    return { error: error.message }
  }

  return { data: data as unknown as ExpedienteRow[] }
}

export async function obtenerDetalleExpediente(id: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("expedientes")
    .select(`
      id,
      codigo_expediente,
      estado,
      observaciones,
      fecha_revision,
      created_at,
      solicitantes!expedientes_solicitante_id_fkey (
        id,
        dni,
        nombres,
        apellido_paterno,
        apellido_materno,
        correo,
        telefono,
        universidad,
        carrera_manual,
        sede_id,
        foto_url,
        titulo_url,
        dni_url,
        validado_reniec
      )
    `)
    .eq("id", id)
    .single()

  if (error) {
    console.error("Error al obtener detalle:", error.message)
    return null
  }

  const { data: pagos } = await supabase
    .from("pagos_inscripcion")
    .select(`
      id,
      tipo_pago,
      monto,
      estado,
      transaccion_id,
      comprobante_url
    `)
    .eq("expediente_id", id)
    .limit(1)

  const dataWithPago = {
    ...data,
    pagos_inscripcion: pagos ?? [],
  }

  return dataWithPago as unknown as ExpedienteDetalle
}

export async function revisarExpedienteConDetalle(
  expedienteId: string,
  accion: "aprobar" | "observar" | "rechazar",
  comentario: string,
  campos: RevisionCampos,
) {
  const auth = await requireAdminRole(["SuperAdmin", "Revisor"])
  if (!auth.success) return { error: auth.error }
  const { supabase, admin } = auth

  if (accion !== "aprobar" && !comentario.trim()) {
    return { error: "Debes agregar un comentario" }
  }

  const { data: actual } = await supabase
    .from("expedientes")
    .select("estado")
    .eq("id", expedienteId)
    .single()

  if (!actual) return { error: "Expediente no encontrado" }

  let estadoNuevo: string
  let tipoNotif: string
  let tituloNotif: string
  let textoNotif: string

  if (accion === "aprobar") {
    estadoNuevo = "Pendiente de pago"
    tipoNotif = "aprobado"
    tituloNotif = "Expediente aprobado"
    textoNotif = "Tu documentación ha sido aprobada. Ahora puedes realizar el pago de inscripción de S/1500."
  } else {
    estadoNuevo = "Rechazado"
    tipoNotif = "rechazado"
    tituloNotif = "Expediente rechazado"
    textoNotif = `Tu expediente ha sido rechazado.\n\n${formatearDetalleCampos(campos)}\n\nMotivo: ${comentario}`
  }

  const { error: errUpdate } = await supabase
    .from("expedientes")
    .update({
      estado: estadoNuevo,
      observaciones: serializarObservaciones(comentario, campos),
      fecha_revision: new Date().toISOString(),
    })
    .eq("id", expedienteId)

  if (errUpdate) return { error: errUpdate.message }

  await supabase.from("historial_estados_expediente").insert({
    expediente_id: expedienteId,
    admin_id: admin.id,
    estado_anterior: actual.estado,
    estado_nuevo: estadoNuevo,
    comentario,
  })

  await crearNotificacion(supabase, expedienteId, tipoNotif, tituloNotif, textoNotif, campos)

  revalidatePath("/admin/expedientes")
  redirect("/admin/expedientes")
}

export async function autoAprobarColegiatura(
  expedienteId: string,
  transaccionId: string,
  db?: ReturnType<typeof createClient>,
) {
  const supabase = db || createClient()

  const { data: expediente } = await supabase
    .from("expedientes")
    .select("id, estado, solicitante_id")
    .eq("id", expedienteId)
    .single()

  if (!expediente) return { error: "Expediente no encontrado" }
  if (expediente.estado !== "Pendiente de pago") return { error: "El expediente no está pendiente de pago" }

  const { data: primeraCarrera } = await supabase
    .from("carreras")
    .select("id")
    .limit(1)
    .single()

  if (!primeraCarrera) return { error: "No hay carreras configuradas en el sistema" }

  const { data: cipResult } = await supabase.rpc("incrementar_cip")
  const numeroCip = cipResult as string

  if (!numeroCip) return { error: "Error al generar el número CIP" }

  const { data: colegiado, error: errColegiado } = await supabase
    .from("colegiados")
    .insert({
      expediente_id: expedienteId,
      carrera_id: primeraCarrera.id,
      numero_cip: numeroCip,
    })
    .select("numero_cip")
    .single()

  if (errColegiado) return { error: errColegiado.message }

  const { error: errEstado } = await supabase
    .from("expedientes")
    .update({ estado: "Aprobado", fecha_revision: new Date().toISOString() })
    .eq("id", expedienteId)

  if (errEstado) return { error: errEstado.message }

  await supabase.from("historial_estados_expediente").insert({
    expediente_id: expedienteId,
    admin_id: null,
    estado_anterior: "Pendiente de pago",
    estado_nuevo: "Aprobado",
    comentario: `Pago ${transaccionId} aprobado automáticamente. CIP: ${colegiado.numero_cip}`,
  })

  await supabase.from("notificaciones").insert({
    solicitante_id: expediente.solicitante_id,
    tipo: "colegiado",
    titulo: "¡Felicidades, eres colegiado!",
    mensaje: `Tu colegiatura ha sido aprobada. Tu CIP es: ${colegiado.numero_cip}. Ya puedes descargar tu carnet digital.`,
  })

  return { success: true, cip: colegiado.numero_cip }
}

export async function aprobarPago(expedienteId: string) {
  const auth = await requireAdminRole(["SuperAdmin", "Tesoreria"])
  if (!auth.success) return { error: auth.error }
  const { supabase } = auth

  const { data: expediente } = await supabase
    .from("expedientes")
    .select(`id, estado`)
    .eq("id", expedienteId)
    .single()

  if (!expediente) return { error: "Expediente no encontrado" }
  if (expediente.estado !== "Pendiente de pago") return { error: "El expediente no está pendiente de pago" }

  const { data: pago } = await supabase
    .from("pagos_inscripcion")
    .select("id, estado, transaccion_id")
    .eq("expediente_id", expedienteId)
    .single()

  if (!pago) return { error: "No se encontró pago para este expediente" }

  const { error: errPago } = await supabase
    .from("pagos_inscripcion")
    .update({ estado: "Aprobado" })
    .eq("id", pago.id)

  if (errPago) return { error: errPago.message }

  const result = await autoAprobarColegiatura(expedienteId, pago.transaccion_id || "ADMIN", supabase)
  if (result.error) return { error: result.error }

  revalidatePath("/admin/expedientes")
  redirect("/admin/expedientes")
}

interface ExpedienteRow {
  id: string
  codigo_expediente: string
  estado: string
  observaciones: string | null
  fecha_revision: string | null
  created_at: string
  solicitantes: {
    id: string
    dni: string
    nombres: string
    apellido_paterno: string
    apellido_materno: string
  }
}

interface ExpedienteDetalle {
  id: string
  codigo_expediente: string
  estado: string
  observaciones: string | null
  fecha_revision: string | null
  created_at: string
  solicitantes: {
    id: string
    dni: string
    nombres: string
    apellido_paterno: string
    apellido_materno: string
    correo: string | null
    telefono: string | null
    universidad: string
    carrera_manual: string
    sede_id: string
    foto_url: string
    titulo_url: string
    dni_url: string
    validado_reniec: boolean
  }
  pagos_inscripcion: {
    id: string
    tipo_pago: string
    monto: number
    estado: string
    transaccion_id: string | null
    comprobante_url: string | null
  }[]
}
