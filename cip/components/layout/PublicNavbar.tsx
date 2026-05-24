import Link from "next/link"
import { createAuthClient } from "@/lib/supabase/auth-server"
import { logoutUser } from "@/actions/user-auth.actions"

export async function PublicNavbar() {
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()

  let nombre = ""
  if (user) {
    const { data: sol } = await supabase
      .from("solicitantes")
      .select("nombres, apellido_paterno")
      .eq("auth_user_id", user.id)
      .single()
    if (sol) nombre = `${sol.nombres} ${sol.apellido_paterno}`
  }

  return (
    <nav className="sticky top-0 z-50 border-b-4 border-cip-gold/70 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cip-red text-sm font-bold text-white">
            CIP
          </div>
          <span className="text-lg font-semibold text-cip-dark">Colegio de Ingenieros</span>
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/sedes"
            className="text-sm font-medium text-gray-600 transition-colors hover:text-cip-red"
          >
            Sedes
          </Link>
          <Link
            href="/solicitar"
            className="rounded-lg bg-cip-red px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cip-red-dark"
          >
            Solicitar Colegiatura
          </Link>
          <Link
            href="/colegiados"
            className="text-sm font-medium text-gray-600 transition-colors hover:text-cip-red"
          >
            Consultar Colegiados
          </Link>

          {user ? (
            <>
              <Link
                href="/micuenta"
                className="rounded-lg border border-blue-700 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-700 hover:text-white"
              >
                Mi Cuenta
              </Link>
              <span className="hidden text-sm text-gray-500 md:inline">{nombre}</span>
              <form action={logoutUser}>
                <button
                  type="submit"
                  className="cursor-pointer rounded-lg border border-cip-red px-4 py-2 text-sm font-medium text-cip-red transition-colors hover:bg-cip-red hover:text-white"
                >
                  Cerrar sesi&oacute;n
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg border border-cip-red px-4 py-2 text-sm font-medium text-cip-red transition-colors hover:bg-cip-red hover:text-white"
            >
              Iniciar sesi&oacute;n
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
