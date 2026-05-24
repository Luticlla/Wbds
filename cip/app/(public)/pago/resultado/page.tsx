"use client"

import { useEffect, useState, Suspense, startTransition } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { mpVerificarPago } from "@/actions/pago.actions"
import { Button } from "@/components/ui/Button"
import { Alert } from "@/components/ui/Alert"
import { Spinner } from "@/components/ui/Spinner"

function PagoResultadoInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [pagina, setPagina] = useState<"loading" | "success" | "failure" | "pending">("loading")

  const paymentId = searchParams.get("payment_id")
  const statusParam = searchParams.get("status")

  useEffect(() => {
    if (!paymentId) {
      startTransition(() => setPagina("failure"))
      return
    }

    if (statusParam === "pending") {
      startTransition(() => setPagina("pending"))
      return
    }

    let cancel = false

    mpVerificarPago(paymentId).then((res) => {
      if (cancel) return
      if (res.ok && res.pago.status === "approved") {
        startTransition(() => setPagina("success"))
        sessionStorage.setItem("mp_pago_cip", JSON.stringify({ paymentId, status: "approved" }))
        setTimeout(() => router.replace("/micuenta"), 2000)
      } else if (res.ok && (res.pago.status === "in_process" || res.pago.status === "pending")) {
        startTransition(() => setPagina("pending"))
      } else {
        startTransition(() => setPagina("failure"))
      }
    }).catch(() => {
      if (!cancel) startTransition(() => setPagina("failure"))
    })

    return () => { cancel = true }
  }, [paymentId, statusParam, router])

  if (pagina === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-4">
          <Spinner size="lg" />
          <p className="text-gray-600">Verificando tu pago...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg py-12 px-4 space-y-6">
      {pagina === "success" && (
        <Alert variant="success" title="¡Pago exitoso!">
          <p>Operación: <strong>{paymentId}</strong></p>
          <p>Redirigiendo a tu cuenta...</p>
        </Alert>
      )}

      {pagina === "failure" && (
        <>
          <Alert variant="error" title="Pago rechazado">
            <p>El pago no pudo ser procesado. Intenta nuevamente.</p>
          </Alert>
          <Button className="w-full" onClick={() => router.replace("/micuenta")}>
            Volver a mi cuenta
          </Button>
        </>
      )}

      {pagina === "pending" && (
        <>
          <Alert variant="info" title="Pago pendiente">
            <p>Tu pago está siendo procesado. Te notificaremos cuando se confirme.</p>
          </Alert>
          <Button className="w-full" onClick={() => router.replace("/micuenta")}>
            Volver a mi cuenta
          </Button>
        </>
      )}
    </div>
  )
}

export default function PagoResultadoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <PagoResultadoInner />
    </Suspense>
  )
}
