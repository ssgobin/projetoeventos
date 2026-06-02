import { BarChart3, CalendarDays, ClipboardList, LogOut } from "lucide-react";
import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Button } from "../components/ui/button";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: BarChart3 },
  { to: "/eventos", label: "Eventos", icon: CalendarDays },
];

function TrebinCredit({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-violet-100 bg-[#090119] p-2 shadow-sm", className)}>
      <div className="flex items-center justify-between gap-3 px-1 pb-1">
        <p className="text-[10px] font-medium uppercase tracking-wide text-white/55">Desenvolvido por</p>
      </div>
      <img src="/trebin_logo.png" alt="Trebin" className="h-11 w-full rounded-lg object-cover object-center" />
    </div>
  );
}

export function AppShell() {
  const { usuario, logout } = useAuth();

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.removeItem("theme");
  }, []);

  return (
    <div className="min-h-screen bg-white text-violet-950">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[17.5rem] border-r border-violet-100 bg-white lg:block">
        <div className="flex h-full flex-col px-5 py-6">
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-950 text-white shadow-sm">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-medium">EventOS</p>
              <p className="text-sm text-violet-950/55">Gestão multiempresa</p>
            </div>
          </div>

          <nav className="space-y-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-violet-950/68 transition",
                    isActive ? "bg-violet-950 text-white shadow-sm" : "hover:bg-violet-50 hover:text-violet-950"
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <TrebinCredit className="mt-auto" />
        </div>
      </aside>

      <div className="lg:pl-[17.5rem]">
        <header className="sticky top-0 z-10 border-b border-violet-100 bg-white/92 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div>
              <p className="text-sm font-medium">{usuario?.nome}</p>
              <p className="text-xs text-violet-950/55">
                {usuario?.role === "adminGeral" ? "Administrador geral" : usuario?.role === "operador" ? "Operador de check-in" : "Administrador da empresa"}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <Outlet />
          <TrebinCredit className="mx-auto mt-10 w-fit lg:hidden" />
        </main>
      </div>
    </div>
  );
}
