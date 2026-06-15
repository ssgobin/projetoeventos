import { Inbox } from "lucide-react";
import { Card } from "./ui/card";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="flex min-h-72 flex-col items-center justify-center py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        <Inbox className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-medium text-slate-950">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
    </Card>
  );
}
