import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input, Label } from "../components/ui/input";
import { useAuth } from "../contexts/AuthContext";
import { registerSchema } from "../validations/schemas";

type FormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { registerEmpresa } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const form = useForm<FormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { nomeEmpresa: "", nomeUsuario: "", email: "", password: "" },
  });

  async function onSubmit(data: FormData) {
    setError("");
    try {
      await registerEmpresa(data);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a conta.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white p-6 text-violet-950">
      <Card className="grid w-full max-w-4xl animate-scale-in overflow-hidden p-0 md:grid-cols-[0.9fr_1.1fr]">
        <aside className="hidden bg-violet-950 p-8 text-white md:block">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-violet-900">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="mt-8 text-3xl font-medium leading-tight">Comece com uma operação organizada desde o primeiro evento.</h1>
          <div className="mt-8 space-y-3 text-sm text-violet-100/82">
            {["Eventos por empresa", "Formulários personalizáveis", "Check-in seguro por operador"].map((item) => (
              <p key={item} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-violet-200" />
                {item}
              </p>
            ))}
          </div>
        </aside>
        <section className="p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-950 text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-medium">Criar empresa</h1>
              <p className="text-sm text-violet-950/60">O primeiro usuário será administrador da organizadora.</p>
            </div>
          </div>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="sm:col-span-2">
              <Label>Nome da empresa</Label>
              <Input {...form.register("nomeEmpresa")} />
            </div>
            <div>
              <Label>Seu nome</Label>
              <Input {...form.register("nomeUsuario")} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" {...form.register("email")} />
            </div>
            <div className="sm:col-span-2">
              <Label>Senha</Label>
              <Input type="password" {...form.register("password")} />
            </div>
            {error && <p className="rounded-md bg-fuchsia-50 px-3 py-2 text-sm text-fuchsia-800 sm:col-span-2">{error}</p>}
            <Button className="sm:col-span-2" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Criando conta..." : "Cadastrar empresa"}</Button>
          </form>
          <p className="mt-5 text-center text-sm text-violet-950/60">
            Já tem conta? <Link className="font-medium text-violet-800 underline decoration-violet-300 underline-offset-4" to="/login">Entrar</Link>
          </p>
        </section>
      </Card>
    </main>
  );
}
