import MercadoPagoConfig, { Preference, Payment } from "mercadopago"

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
})

export interface CrearPreferenciaInput {
  monto: number
  titulo: string
  externalReference: string
}

export interface CrearPreferenciaResult {
  id: string
  initPoint: string
}

export async function crearPreferenciaCheckoutPro(
  input: CrearPreferenciaInput
): Promise<CrearPreferenciaResult> {
  const baseUrl = (process.env.NEXT_PUBLIC_URL || "http://localhost:3000").replace(/\/+$/, "")

  const body = {
    items: [
      {
        id: input.externalReference,
        title: input.titulo,
        quantity: 1,
        unit_price: input.monto,
        currency_id: "PEN",
      },
    ],
    back_urls: {
      success: `${baseUrl}/pago/resultado`,
      failure: `${baseUrl}/pago/resultado`,
      pending: `${baseUrl}/pago/resultado`,
    },
    ...(baseUrl.startsWith("https") && { auto_return: "approved" }),
    notification_url: `${baseUrl}/api/pago/webhook`,
    external_reference: input.externalReference,
    binary_mode: true,
    three_d_secure_mode: "not_supported",
    payment_methods: {
      installments: 1,
    },
  }

  const result = await new Preference(client).create({ body })

  const initPoint = process.env.MP_MODE === "sandbox"
    ? result.sandbox_init_point!
    : result.init_point!

  return { id: result.id!, initPoint }
}

export async function verificarPago(paymentId: string) {
  const payment = await new Payment(client).get({ id: paymentId })

  return {
    id: payment.id,
    status: payment.status,
    statusDetail: payment.status_detail,
    externalReference: payment.external_reference,
    payerEmail: payment.payer?.email ?? null,
    transactionAmount: payment.transaction_amount,
  }
}
