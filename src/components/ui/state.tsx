import { AlertCircle, Loader2 } from "lucide-react";
import { Card } from "./card";
import { Button } from "./button";

export function LoadingState({ title = "Carregando", description }: { title?: string; description?: string }) {
  return (
    <Card className="flex min-h-40 flex-col items-center justify-center p-8 text-center" role="status" aria-live="polite">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-600" aria-hidden="true" />
      <p className="mt-4 text-sm font-medium text-slate-950">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}
    </Card>
  );
}

export function ErrorState({ title = "Não foi possível carregar", description, onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  return (
    <Card className="flex min-h-40 flex-col items-center justify-center p-8 text-center" role="alert">
      <AlertCircle className="h-8 w-8 text-rose-600" aria-hidden="true" />
      <p className="mt-4 text-sm font-medium text-slate-950">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {onRetry && <Button className="mt-5" variant="secondary" onClick={onRetry}>Tentar novamente</Button>}
    </Card>
  );
}
