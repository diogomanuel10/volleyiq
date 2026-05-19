import { Link } from "wouter";
import { ArrowRight, BookOpen, Code2, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Step {
  number: number;
  title: string;
  description: string;
  href: string;
  linkLabel: string;
}

const STEPS: Step[] = [
  {
    number: 1,
    title: "Criar a tua equipa",
    description:
      "Preenche o nome da equipa, clube e categoria. Estes dados aparecem nos relatórios e exportações.",
    href: "/settings",
    linkLabel: "Definições da equipa",
  },
  {
    number: 2,
    title: "Adicionar jogadoras",
    description:
      "Regista o teu plantel com números de camisola e posições. Podes editar ou adicionar jogadoras a qualquer momento.",
    href: "/players",
    linkLabel: "Gerir jogadoras",
  },
  {
    number: 3,
    title: "Criar um jogo",
    description:
      "Agenda um jogo com adversário, data e competição. O jogo fica disponível para scouting ao vivo.",
    href: "/matches",
    linkLabel: "Ver jogos",
  },
  {
    number: 4,
    title: "Scouting ao vivo",
    description:
      "Durante o jogo, regista ações em tempo real: serviços, ataques, receções e muito mais.",
    href: "/scout",
    linkLabel: "Ir para scouting",
  },
  {
    number: 5,
    title: "Analisar os dados",
    description:
      "Após o jogo, consulta o dashboard: Kill%, Side-Out%, estatísticas por rotação e evolução ao longo da época.",
    href: "/",
    linkLabel: "Ver dashboard",
  },
  {
    number: 6,
    title: "Exportar e integrar",
    description:
      "Exporta os dados para Excel, usa a API pública ou configura webhooks para integrar com outras ferramentas.",
    href: "/settings/api-keys",
    linkLabel: "Chaves de API",
  },
];

function StepCard({ step }: { step: Step }) {
  return (
    <Card className="border border-border bg-card">
      <CardContent className="p-6">
        <div className="flex items-start gap-5">
          {/* Number circle */}
          <div className="shrink-0 h-10 w-10 rounded-full border-2 border-primary bg-primary/10 text-primary grid place-items-center font-bold text-sm">
            {step.number}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            <h3 className="font-semibold text-base leading-tight">{step.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {step.description}
            </p>
            <div className="pt-1">
              <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 px-2 -ml-2 text-primary hover:text-primary">
                <Link href={step.href}>
                  {step.linkLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GettingStartedPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-10">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-primary mb-1">
          <BookOpen className="h-5 w-5" />
          <span className="text-sm font-medium uppercase tracking-wide">Guia de início</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Como Começar</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Segue estes seis passos para tirar o máximo partido do VolleyIQ — desde a criação
          da equipa até à integração com as tuas ferramentas.
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {STEPS.map((step) => (
          <StepCard key={step.number} step={step} />
        ))}
      </div>

      {/* Help section */}
      <Card className="border border-border bg-muted/40">
        <CardContent className="p-6 space-y-4">
          <h2 className="font-semibold text-base">Ainda tens dúvidas?</h2>
          <p className="text-sm text-muted-foreground">
            Consulta a documentação técnica da API ou entra em contacto com a nossa equipa
            de suporte.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild variant="outline" size="sm" className="gap-2">
              <a href="/#/docs/api">
                <Code2 className="h-4 w-4" />
                Documentação da API
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <a href="mailto:suporte@volleyiq.app">
                <Mail className="h-4 w-4" />
                suporte@volleyiq.app
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
