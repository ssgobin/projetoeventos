import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CalendarCheck, ClipboardCheck, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input, Label } from "../components/ui/input";
import { useAuth } from "../contexts/AuthContext";
import { loginSchema } from "../validations/schemas";

type FormData = z.infer<typeof loginSchema>;

const highlights = [
  [CalendarCheck, "Eventos organizados por empresa"],
  [ClipboardCheck, "Formulários personalizados para cada público"],
  [ShieldCheck, "Operação segura para check-in e convidados"],
] as const;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const form = useForm<FormData>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  async function onSubmit(data: FormData) {
    setError("");
    try {
      await login(data.email, data.password);
      navigate("/");
    } catch {
      setError("E-mail ou senha inválidos.");
    }
  }

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <div className="mx-auto grid min-h-screen max-w-7xl items-center gap-12 px-6 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
        <section className="animate-fade-up">
          <div className="mb-16 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-sm font-medium text-white">EO</span>
            <div>
              <p className="text-base font-medium">EventOS</p>
              <p className="text-sm text-slate-500">Gestão premium para eventos</p>
            </div>
          </div>

          <p className="page-kicker">Gestão multiempresa</p>
          <h1 className="mt-3 max-w-3xl text-5xl font-medium leading-[1.05] tracking-normal sm:text-6xl">
            Organize eventos com uma experiência simples, bonita e segura.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-950/66">
            Crie eventos, personalize formulários, envie convites com QR Code e acompanhe check-ins em uma área administrativa clara e profissional.
          </p>

          <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
            {highlights.map(([Icon, text]) => (
              <div key={text} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <Icon className="h-5 w-5 text-indigo-700" />
                <p className="mt-4 text-sm leading-5 text-slate-950/72">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex justify-center lg:justify-end">
          <Card className="w-full max-w-md animate-scale-in p-8">
            <h2 className="text-3xl font-medium tracking-normal">Entrar na conta</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Acesse a área administrativa da sua empresa.</p>
            <form className="mt-7 space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
              <div>
                <Label>E-mail</Label>
                <Input type="email" {...form.register("email")} />
                <p className="mt-1 text-xs text-rose-600">{form.formState.errors.email?.message}</p>
              </div>
              <div>
                <Label>Senha</Label>
                <Input type="password" {...form.register("password")} />
                <p className="mt-1 text-xs text-rose-600">{form.formState.errors.password?.message}</p>
              </div>
              {error && <p className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
              <Button className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Entrando..." : "Entrar"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-slate-500">
              Ainda não tem conta?{" "}
              <Link to="/cadastro" className="font-medium text-indigo-700 underline decoration-indigo-300 underline-offset-4">
                Criar empresa
              </Link>
            </p>
          </Card>
        </section>
      </div>
    </main>
  );
}
