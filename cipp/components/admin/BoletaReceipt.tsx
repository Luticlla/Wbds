"use client"

import { useRef } from "react"
import { toPng } from "html-to-image"
import { Button } from "@/components/ui/Button"
import { nombreMes } from "@/lib/constants"

interface PagoBoleta {
  anio: number
  mes: number
  monto: number
}

interface Props {
  numeroCip: string
  nombres: string
  apellidoPaterno: string
  apellidoMaterno: string
  dni: string
  pagos: PagoBoleta[]
  totalMonto: number
  fechaPago: string
  concepto?: string
  onClose?: () => void
}

function formatFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function BoletaReceipt({
  numeroCip,
  nombres,
  apellidoPaterno,
  apellidoMaterno,
  dni,
  pagos,
  totalMonto,
  fechaPago,
  concepto = "Pago de mensualidades CIP",
  onClose,
}: Props) {
  const receiptRef = useRef<HTMLDivElement>(null)

  async function handleDownload() {
    if (!receiptRef.current) return
    try {
      const dataUrl = await toPng(receiptRef.current, {
        pixelRatio: 2,
        quality: 1,
        backgroundColor: "#ffffff",
      })
      const link = document.createElement("a")
      link.download = `boleta-cip-${numeroCip}-${Date.now()}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error("Error al generar boleta:", err)
    }
  }

  const numeroBoleta = `B-${numeroCip}-${Date.now().toString(36).toUpperCase()}`

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        )}
        <Button onClick={handleDownload}>
          Descargar Boleta
        </Button>
      </div>

      <div
        ref={receiptRef}
        className="mx-auto w-[400px] rounded-lg border-2 border-gray-800 bg-white p-6 font-mono text-sm shadow-lg"
        style={{ fontFamily: "'Courier New', Courier, monospace" }}
      >
        {/* Header */}
        <div className="text-center border-b-2 border-dashed border-gray-400 pb-4 mb-4">
          <p className="text-lg font-bold tracking-wider">COLEGIO DE INGENIEROS DEL PERÚ</p>
          <p className="text-xs text-gray-600">Consejo Nacional</p>
          <div className="mt-2 flex justify-center">
            <div className="h-16 w-16 rounded-full border-2 border-gray-800 flex items-center justify-center">
              <span className="text-xs font-bold text-center leading-tight">
                CIP<br />{numeroCip}
              </span>
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-4">
          <p className="font-bold text-base">BOLETA DE PAGO</p>
          <p className="text-xs text-gray-500">N° {numeroBoleta}</p>
        </div>

        {/* Datos del colegiado */}
        <div className="border-b border-gray-300 pb-3 mb-3">
          <p className="text-xs font-bold mb-1">DATOS DEL COLEGIADO</p>
          <p>CIP: {numeroCip}</p>
          <p>DNI: {dni}</p>
          <p>
            {apellidoPaterno} {apellidoMaterno}, {nombres}
          </p>
        </div>

        {/* Detalle de pagos */}
        <div className="border-b border-gray-300 pb-3 mb-3">
          <p className="text-xs font-bold mb-1">DETALLE DE PAGO</p>
          <p className="text-xs text-gray-500">Concepto: {concepto}</p>
          {pagos.length > 0 ? pagos.map((p) => (
            <div key={`${p.anio}-${p.mes}`} className="flex justify-between text-xs mt-1">
              <span>{nombreMes(p.mes)} {p.anio}</span>
              <span>S/ {p.monto.toFixed(2)}</span>
            </div>
          )) : (
            <div className="flex justify-between text-xs mt-1">
              <span>{concepto}</span>
              <span>S/ {totalMonto.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Total */}
        <div className="flex justify-between font-bold text-base border-b border-gray-300 pb-3 mb-3">
          <span>TOTAL PAGADO</span>
          <span>S/ {totalMonto.toFixed(2)}</span>
        </div>

        {/* Estado */}
        <div className="text-center mb-3">
          <span className="inline-block border border-green-600 text-green-700 font-bold px-4 py-1 text-xs tracking-widest">
            PAGADO
          </span>
        </div>

        {/* Fecha */}
        <div className="text-center text-xs text-gray-500 border-t border-dashed border-gray-400 pt-3">
          <p>Fecha de pago: {formatFecha(fechaPago)}</p>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 mt-2">
          <p>Este comprobante es emitido por el sistema CIP</p>
          <p>Válido como constancia de pago</p>
        </div>
      </div>
    </div>
  )
}
