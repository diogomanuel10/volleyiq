import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Componente interno usado pelas páginas ainda por implementar nas Fases 2–4.
 * Comunica o que vai conter quando estiver pronta, em vez de um ecrã em branco.
 */
export function Placeholder({
  title,
  subtitle,
  phase,
  bullets,
  children,
}: {
  title: string;
  subtitle?: string;
  phase: "F2" | "F3" | "F4";
  bullets: string[];
  children?: ReactNode;
}) {
  return (
    <div className="p-4 md:p-8 max-w-screen-2xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="text-muted-foreground text-sm">{subtitle}</p>
          )}
        </div>
        <Badge variant="outline">Fase {phase.slice(1)}</Badge>
      </header>
      <Card>
        <CardContent className="p-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            Esta página ainda não está implementada nesta fase.
            Vai conter:
          </p>
          <ul className="text-sm list-disc pl-5 space-y-1">
            {bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          {children}
        </CardContent>
      </Card>
    </div>
  );
}
