import { BarChart3, CalendarDays, ClipboardList, LogOut, Menu, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
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
    <div className={cn("flex justify-center", className)}>
      <a href="https://trebintech.com" target="_blank" rel="noopener noreferrer">
        <img src="/trebin_logo.png" alt="Trebin" className="h-10 w-auto object-contain opacity-80" />
      </a>
    </div>
  );
}

export function AppShell() {
  const { usuario, logout } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.removeItem("theme");
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileSidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileSidebarOpen]);

  function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <div className="flex h-full flex-col px-4 py-5">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-bold tracking-normal text-slate-950">EventOS</p>
            <p className="text-xs font-medium text-slate-500">Gestão de eventos</p>
          </div>
        </div>

        <p className="mb-2 px-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Principal</p>
        <nav className="space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition",
                  isActive ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Conta</p>
          <p className="mt-2 truncate text-sm font-semibold text-slate-900">{usuario?.nome}</p>
          <p className="mt-1 text-xs text-slate-500">
            {usuario?.role === "adminGeral" ? "Administrador geral" : usuario?.role === "operador" ? "Operador de check-in" : "Administrador da empresa"}
          </p>
        </div>
        <TrebinCredit className="mt-5" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[17rem] border-r border-slate-200 bg-white lg:block">
        <SidebarContent />
      </aside>

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-30 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu principal">
          <button className="absolute inset-0 bg-slate-950/45" type="button" aria-label="Fechar menu" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="relative h-full w-[18rem] max-w-[86vw] animate-fade-up border-r border-slate-200 bg-white shadow-2xl">
            <div className="absolute right-3 top-3">
              <Button type="button" variant="ghost" size="icon" onClick={() => setMobileSidebarOpen(false)} aria-label="Fechar menu">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <SidebarContent onNavigate={() => setMobileSidebarOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-[17rem]">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex min-h-16 max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:h-16 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  className="lg:hidden"
                  variant="secondary"
                  size="icon"
                  onClick={() => setMobileSidebarOpen((open) => !open)}
                  aria-label={mobileSidebarOpen ? "Fechar menu" : "Abrir menu"}
                >
                  {mobileSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </Button>
                <div>
                  <p className="text-sm font-semibold text-slate-950">{usuario?.nome}</p>
                  <p className="text-xs text-slate-500">
                    {usuario?.role === "adminGeral" ? "Administrador geral" : usuario?.role === "operador" ? "Operador de check-in" : "Administrador da empresa"}
                  </p>
                </div>
              </div>
              <Button className="lg:hidden" variant="secondary" size="sm" onClick={logout}>
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </div>

            <div className="hidden items-center gap-3 lg:flex">
              <div className="flex h-10 w-72 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400">
                <Search className="h-4 w-4" />
                Buscar em breve
              </div>
              <Button variant="secondary" size="sm" onClick={logout}>
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
          <TrebinCredit className="mx-auto mt-10 w-fit lg:hidden" />
        </main>
      </div>
    </div>
  );
}
