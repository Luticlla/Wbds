import { createClient } from "@/lib/supabase/server"
import { createAuthClient } from "@/lib/supabase/auth-server"
import { FormularioDatos } from "./FormularioDatos"
import { Alert } from "@/components/ui/Alert"
import { obtenerUniversidades } from "@/lib/carreras"

export default async function DatosPage() {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <p className="text-center text-gray-500">No autenticado</p>

  const serverClient = createClient()
  const { data: solicitante } = await serverClient
    .from("solicitantes")
    .select("id, dni, nombres, apellido_paterno, apellido_materno, correo, telefono, universidad, universidad_id, carrera_manual, sede_id")
    .eq("auth_user_id", user.id)
    .single()

  if (!solicitante) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <Alert variant="warning" title="Sin datos">No se encontraron tus datos.</Alert>
      </div>
    )
  }

  const [sedes, universidades] = await Promise.all([
    serverClient.from("sedes").select("id, nombre"),
    obtenerUniversidades(),
  ])

  const sede = sedes.data?.find((s) => s.id === solicitante.sede_id)

  const { data: expediente } = await serverClient
    .from("expedientes")
    .select("estado")
    .eq("solicitante_id", solicitante.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const esColegiado = expediente?.estado === "Aprobado"

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Mis Datos</h1>

      {esColegiado && (
        <Alert variant="info" title="Datos protegidos">
          Al ser colegiado, solo puedes modificar tu correo y teléfono. El resto de datos están bloqueados.
        </Alert>
      )}

      <div className="rounded-lg border bg-white p-6">
        <div className="mb-6 grid gap-2 text-sm sm:grid-cols-2">
          <div><span className="font-medium text-gray-500">DNI:</span> <span className="text-gray-800">{solicitante.dni}</span></div>
          <div><span className="font-medium text-gray-500">Nombre completo:</span> <span className="text-gray-800">{solicitante.nombres} {solicitante.apellido_paterno} {solicitante.apellido_materno}</span></div>
          <div><span className="font-medium text-gray-500">Carrera:</span> <span className="text-gray-800">{solicitante.carrera_manual || "-"}</span></div>
          <div><span className="font-medium text-gray-500">Sede:</span> <span className="text-gray-800">{sede?.nombre}</span></div>
          <div><span className="font-medium text-gray-500">Correo:</span> <span className="text-gray-800">{solicitante.correo}</span></div>
          <div><span className="font-medium text-gray-500">Teléfono:</span> <span className="text-gray-800">{solicitante.telefono || "-"}</span></div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">
            {esColegiado ? "Editar contacto" : "Editar datos editables"}
          </h2>
          <FormularioDatos
            correo={solicitante.correo ?? ""}
            telefono={solicitante.telefono ?? ""}
            universidadId={solicitante.universidad_id ?? null}
            universidades={universidades}
            carreraManual={solicitante.carrera_manual ?? ""}
            esColegiado={esColegiado}
          />
        </div>
      </div>
    </div>
  )
}
