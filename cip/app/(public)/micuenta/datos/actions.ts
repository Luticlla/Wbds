"use server"

import { requireUser } from "@/lib/auth-helper"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export async function actualizarDatos(formData: FormData) {
  const auth = await requireUser()
  if (!auth.success) return { error: auth.error }
  const { supabase, solicitante } = auth

  const serverClient = createClient()
  const { data: expediente } = await serverClient
    .from("expedientes")
    .select("estado")
    .eq("solicitante_id", solicitante.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const esColegiado = expediente?.estado === "Aprobado"

  const correo = formData.get("correo") as string
  const telefono = formData.get("telefono") as string

  const updates: Record<string, string | null> = {}

  if (correo) updates.correo = correo
  if (telefono) updates.telefono = telefono

  if (!esColegiado) {
    const universidadId = formData.get("universidad_id") as string
    const carreraManual = formData.get("carrera_manual") as string

    if (universidadId) {
      updates.universidad_id = universidadId
      const { data: univ } = await serverClient
        .from("universidades")
        .select("nombre")
        .eq("id", universidadId)
        .single()
      if (univ) updates.universidad = univ.nombre
    }

    if (carreraManual) {
      updates.carrera_manual = carreraManual
    }
  }

  if (Object.keys(updates).length === 0) return { error: "No hay datos para actualizar" }

  const { error } = await supabase
    .from("solicitantes")
    .update(updates)
    .eq("id", solicitante.id)

  if (error) return { error: error.message }

  revalidatePath("/micuenta/datos")
  return { success: true }
}
