"use server"

import { requireUser } from "@/lib/auth-helper"
import { revalidatePath } from "next/cache"
import { crearPreferenciaCheckoutPro } from "@/lib/pago/mercadopago"

export async function obtenerDeuda() {
  const auth = await requireUser()
  if (!auth.success) return { error: auth.error }
  const { supabase, solicitante } = auth

  const { data: expediente } = await supabase
    .from("expedientes")
    .select("id")
    .eq("solicitante_id", solicitante.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!expediente) return { error: "No tienes un expediente registrado" }

  const { data: colegiado } = await supabase
    .from("colegiados")
    .select("id, estado_habilitacion, fecha_colegiatura")
    .eq("expediente_id", expediente.id)
    .maybeSingle()

  if (!colegiado) return { error: "Aún no eres colegiado. Debes esperar la aprobación de tu expediente." }

  const ahora = new Date()
  const anioActual = ahora.getFullYear()
  const mesActual = ahora.getMonth() + 1

  const [anioStr, mesStr] = colegiado.fecha_colegiatura.split("-")
  let mesInicio = parseInt(mesStr) + 1
  let anioInicio = parseInt(anioStr)

  if (mesInicio > 12) {
    mesInicio = 1
    anioInicio++
  }

  const mesesPagados = new Set<string>()

  const { data: pagos } = await supabase
    .from("pagos_mensualidades")
    .select("anio, mes")
    .eq("colegiado_id", colegiado.id)
    .eq("estado", "Pagado")

  for (const p of pagos ?? []) {
    mesesPagados.add(`${p.anio}-${p.mes}`)
  }

  const mesesAdeudados: { anio: number; mes: number }[] = []
  let currentAnio = anioInicio
  let currentMes = mesInicio

  while (currentAnio < anioActual || (currentAnio === anioActual && currentMes < mesActual)) {
    if (!mesesPagados.has(`${currentAnio}-${currentMes}`)) {
      mesesAdeudados.push({ anio: currentAnio, mes: currentMes })
    }
    currentMes++
    if (currentMes > 12) {
      currentMes = 1
      currentAnio++
    }
  }

  const totalDeuda = mesesAdeudados.length * 20

  return {
    data: {
      colegiadoId: colegiado.id,
      estadoHabilitacion: colegiado.estado_habilitacion,
      mesesAdeudados,
      totalDeuda,
      mesActual,
      anioActual,
    },
  }
}

export async function listarPagosMensuales() {
  const auth = await requireUser()
  if (!auth.success) return { error: auth.error, data: [] }
  const { supabase, solicitante } = auth

  const { data: expediente } = await supabase
    .from("expedientes")
    .select("id")
    .eq("solicitante_id", solicitante.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!expediente) return { error: null, data: [] }

  const { data: colegiado } = await supabase
    .from("colegiados")
    .select("id")
    .eq("expediente_id", expediente.id)
    .maybeSingle()

  if (!colegiado) return { error: null, data: [] }

  const { data, error } = await supabase
    .from("pagos_mensualidades")
    .select("*")
    .eq("colegiado_id", colegiado.id)
    .order("anio", { ascending: false })
    .order("mes", { ascending: false })

  if (error) return { error: error.message, data: [] }

  return { data, error: null }
}

export async function mpCrearPreferenciaMensual(colegiadoId: string, total: number) {
  try {
    const resultado = await crearPreferenciaCheckoutPro({
      monto: total,
      titulo: "Pago de mensualidades CIP",
      externalReference: `MENSUAL-${colegiadoId}`,
    })
    return { ok: true as const, initPoint: resultado.initPoint, preferenceId: resultado.id }
  } catch (error: unknown) {
    const err = error as { cause?: string; message?: string; response?: unknown }
    console.error("[MP Error Mensual]", err?.cause || err?.message || error)
    return { ok: false as const, error: `Error al crear la preferencia: ${err?.message || "ver consola"}` }
  }
}

export async function registrarPagoMensual(formData: FormData) {
  const auth = await requireUser()
  if (!auth.success) return { error: auth.error }
  const { supabase, solicitante } = auth

  const { data: expediente } = await supabase
    .from("expedientes")
    .select("id")
    .eq("solicitante_id", solicitante.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!expediente) return { error: "No tienes un expediente registrado" }

  const { data: colegiado } = await supabase
    .from("colegiados")
    .select("id")
    .eq("expediente_id", expediente.id)
    .maybeSingle()

  if (!colegiado) return { error: "Aún no eres colegiado" }

  const anio = parseInt(formData.get("anio") as string)
  const mes = parseInt(formData.get("mes") as string)
  const tipoPago = formData.get("tipo_pago") as string || "Virtual"

  if (!anio || !mes) return { error: "Año y mes son requeridos" }

  const { error } = await supabase
    .from("pagos_mensualidades")
    .upsert({
      colegiado_id: colegiado.id,
      anio,
      mes,
      monto: 20,
      tipo_pago: tipoPago,
      estado: "Pagado",
    }, { onConflict: "colegiado_id, anio, mes" })

  if (error) return { error: error.message }

  revalidatePath("/micuenta/pagos")
  return { success: true }
}


