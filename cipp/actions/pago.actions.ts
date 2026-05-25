"use server"

import { crearPreferenciaCheckoutPro, verificarPago } from "@/lib/pago/mercadopago"

export async function mpCrearPreferencia(datos: {
  monto: number
  titulo: string
  externalReference: string
}) {
  try {
    const resultado = await crearPreferenciaCheckoutPro(datos)
    return { ok: true as const, initPoint: resultado.initPoint, preferenceId: resultado.id }
  } catch (error: unknown) {
    const err = error as { cause?: string; message?: string; response?: unknown }
    console.error("[MP Error]", err?.cause || err?.message || error)
    if (err?.response) {
      console.error("[MP Error] response:", JSON.stringify(err.response, null, 2))
    }
    return { ok: false as const, error: `Error al crear la preferencia: ${err?.message || "ver consola"}` }
  }
}

export async function mpVerificarPago(paymentId: string) {
  try {
    const pago = await verificarPago(paymentId)
    return { ok: true as const, pago }
  } catch (error) {
    console.error("Error verificando pago MP:", error)
    return { ok: false as const, error: "Error al verificar el pago" }
  }
}
