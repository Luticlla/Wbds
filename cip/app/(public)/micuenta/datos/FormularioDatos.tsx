"use client"

import { useActionState } from "react"
import { actualizarDatos } from "./actions"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Alert } from "@/components/ui/Alert"
import type { Universidad } from "@/types"

interface Props {
  correo: string
  telefono: string
  universidadId: string | null
  universidades: Universidad[]
  carreraManual: string
  esColegiado?: boolean
}

export function FormularioDatos({
  correo,
  telefono,
  universidadId,
  universidades,
  carreraManual,
  esColegiado = false,
}: Props) {
  const [state, formAction, pending] = useActionState(
    async (_prev: unknown, formData: FormData) => actualizarDatos(formData),
    null,
  )

  return (
    <form action={formAction} className="space-y-4">
      <Input label="Correo electrónico" name="correo" type="email" defaultValue={correo} required />
      <Input label="Teléfono" name="telefono" defaultValue={telefono} />

      {!esColegiado && (
        <>
          <Select
            label="Universidad"
            placeholder="Selecciona una universidad"
            options={universidades.map((u) => ({ value: u.id, label: u.nombre }))}
            name="universidad_id"
            defaultValue={universidadId ?? ""}
          />

          <Input
            label="Carrera de ingeniería"
            name="carrera_manual"
            placeholder="Escribe el nombre de tu carrera"
            defaultValue={carreraManual}
          />
        </>
      )}

      {state && "success" in state && (
        <Alert variant="success">Datos actualizados correctamente.</Alert>
      )}
      {state && "error" in state && (
        <Alert variant="error">{(state as { error: string }).error}</Alert>
      )}

      <Button type="submit" loading={pending}>
        Guardar cambios
      </Button>
    </form>
  )
}
