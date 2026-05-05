import { useEffect, useState } from "react";
import {
  Gauge,
  HelpCircle,
  Keyboard,
  LifeBuoy,
  PlayCircle,
  Users,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export type ScoutHelpTab =
  | "quickstart"
  | "shortcuts"
  | "modes"
  | "lineup"
  | "faq";

function K({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.6rem] h-6 px-1.5 rounded border bg-muted text-[11px] font-mono">
      {children}
    </kbd>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
        {n}
      </div>
      <div className="space-y-1">
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-muted-foreground leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}

const SHORTCUT_SECTIONS: Array<{ title: string; rows: Array<[React.ReactNode, string]> }> = [
  {
    title: "Sempre",
    rows: [
      [
        <>
          <K>Ctrl</K>+<K>Z</K> ou <K>⌫</K>
        </>,
        "Anular última acção",
      ],
      [<K>Esc</K>, "Cancelar selecção em curso"],
      [<K>?</K>, "Mostrar/ocultar ajuda"],
    ],
  },
  {
    title: "Escolher jogadora",
    rows: [
      [
        <>
          <K>0</K>–<K>9</K>
        </>,
        "Digita o nº de camisola (até 2 dígitos)",
      ],
    ],
  },
  {
    title: "Escolher acção",
    rows: [
      [<K>1</K>, "Serviço"],
      [<K>2</K>, "Recepção"],
      [<K>3</K>, "Distribuição"],
      [<K>4</K>, "Ataque"],
      [<K>5</K>, "Bloco"],
      [<K>6</K>, "Defesa"],
    ],
  },
  {
    title: "Escolher zona",
    rows: [
      [
        <>
          <K>1</K>…<K>9</K>
        </>,
        "Zona DataVolley (origem ou destino)",
      ],
      [<K>Space</K>, "Saltar zona (modo Lite)"],
    ],
  },
  {
    title: "Resultado",
    rows: [
      [<K>#</K>, "Perfeito / kill / ace / stuff"],
      [<K>+</K>, "Bom / em jogo positivo"],
      [<K>-</K>, "Fraco / bloqueado"],
      [<K>/</K>, "Tooled (toca no bloco e sai)"],
      [<K>!</K>, "Em jogo (neutro)"],
      [<K>=</K>, "Erro"],
    ],
  },
];

const FAQ: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: "A acção que registei não aparece no log",
    a: "O log à direita mostra as últimas 12 acções. Se a acção parece em falta, verifica a ligação à internet — as acções são guardadas em background. Em caso de erro vai aparecer um toast.",
  },
  {
    q: "Quero corrigir uma acção mal registada",
    a: (
      <>
        Carrega <K>⌫</K> ou <K>Ctrl</K>+<K>Z</K>, ou clica no botão{" "}
        <strong>Undo</strong> no topo do log. A acção é apagada também no
        servidor.
      </>
    ),
  },
  {
    q: "O vídeo não está a sincronizar com as acções",
    a: "Cada acção é gravada com o tempo actual do vídeo. Se o vídeo não foi configurado, a acção é guardada sem timestamp. Edita o jogo e adiciona um URL de vídeo (YouTube, Vimeo ou ficheiro directo).",
  },
  {
    q: "Uma jogadora não aparece no campo",
    a: 'Verifica que a jogadora está marcada como "Activa no roster" em /jogadoras. Se sim, define o lineup do set actual carregando em "Definir lineup".',
  },
  {
    q: "Posso usar o LiveScout num tablet?",
    a: "Sim. O modo táctil está optimizado para tablet. Em ecrãs maiores ganhas atalhos de teclado e o painel lateral com vídeo + log.",
  },
];

export function KeyboardHelp({
  open,
  onOpenChange,
  initialTab = "shortcuts",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Tab a abrir por omissão (útil quando vem do banner de boas-vindas). */
  initialTab?: ScoutHelpTab;
}) {
  const [tab, setTab] = useState<ScoutHelpTab>(initialTab);

  // Sempre que se reabre, respeita o tab pedido pelo chamador.
  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4" /> Ajuda do Live Scout
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as ScoutHelpTab)}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="quickstart">
              <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
              Início rápido
            </TabsTrigger>
            <TabsTrigger value="shortcuts">
              <Keyboard className="h-3.5 w-3.5 mr-1.5" />
              Atalhos
            </TabsTrigger>
            <TabsTrigger value="modes">
              <Gauge className="h-3.5 w-3.5 mr-1.5" />
              Modos
            </TabsTrigger>
            <TabsTrigger value="lineup">
              <Users className="h-3.5 w-3.5 mr-1.5" />
              Lineup & Subs
            </TabsTrigger>
            <TabsTrigger value="faq">
              <HelpCircle className="h-3.5 w-3.5 mr-1.5" />
              FAQ
            </TabsTrigger>
          </TabsList>

          {/* ── Início rápido ─────────────────────────────────────────── */}
          <TabsContent value="quickstart">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Em 30 segundos sabes registar uma acção. O fluxo é o mesmo em
                tablet (toque) ou portátil (rato + teclado).
              </p>
              <div className="space-y-3">
                <Step n={1} title="Escolhe a jogadora">
                  Toca numa jogadora no campo, ou digita o nº de camisola no
                  teclado (ex: <K>1</K> <K>2</K> = #12).
                </Step>
                <Step n={2} title="Escolhe a acção">
                  Serviço, recepção, distribuição, ataque, bloco ou defesa.
                  Atalho: <K>1</K>–<K>6</K>.
                </Step>
                <Step n={3} title="Marca zona e resultado">
                  No modo <strong>Lite</strong> só marcas a zona de destino
                  (opcional). No modo <strong>Completo</strong>, marcas
                  origem → destino. Depois escolhe o resultado (<K>#</K>{" "}
                  <K>+</K> <K>-</K> <K>=</K> …).
                </Step>
                <Step n={4} title="Engana-te? Anula">
                  <K>Ctrl</K>+<K>Z</K> ou <K>⌫</K> apaga a última acção (em
                  servidor também). Para cancelar uma selecção a meio: <K>Esc</K>.
                </Step>
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                💡 As acções são gravadas automaticamente. Não precisas de
                clicar em "guardar".
              </div>
            </div>
          </TabsContent>

          {/* ── Atalhos ──────────────────────────────────────────────── */}
          <TabsContent value="shortcuts">
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              {SHORTCUT_SECTIONS.map((sec) => (
                <div key={sec.title} className="space-y-1.5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {sec.title}
                  </div>
                  <ul className="space-y-1">
                    {sec.rows.map(([keys, label], i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="flex items-center gap-1">{keys}</span>
                        <span className="text-muted-foreground text-xs text-right">
                          {label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground pt-3">
              Os atalhos respeitam o passo actual: o mesmo número selecciona
              jogadora, acção ou zona consoante o que estiveres a registar.
            </p>
          </TabsContent>

          {/* ── Modos ────────────────────────────────────────────────── */}
          <TabsContent value="modes">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <div className="font-semibold text-sm">Lite</div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Fluxo curto: jogadora → acção → zona (opcional) →
                  resultado. Ideal para scouting rápido durante o jogo, ou
                  para começar sem fricção.
                </p>
                <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
                  <li>4 passos</li>
                  <li>Zona opcional (<K>Space</K> salta)</li>
                  <li>Disponível em todos os planos</li>
                </ul>
              </div>
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-primary" />
                  <div className="font-semibold text-sm">Completo</div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Fluxo táctico: jogadora → acção → origem → destino →
                  resultado. Permite analisar trajectórias, heatmaps por
                  origem, e padrões de ataque por rotação.
                </p>
                <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
                  <li>5 passos</li>
                  <li>Sugestão da próxima acção provável</li>
                  <li>Requer plano Pro ou Club</li>
                </ul>
              </div>
            </div>
            <div className="mt-3 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              💡 Podes alternar a qualquer momento no toggle do canto
              superior direito. A escolha fica guardada por equipa.
            </div>
          </TabsContent>

          {/* ── Lineup & Subs ────────────────────────────────────────── */}
          <TabsContent value="lineup">
            <div className="space-y-3 text-sm">
              <div>
                <div className="font-semibold mb-1">Definir lineup do set</div>
                <p className="text-xs text-muted-foreground">
                  Carrega no botão <strong>Definir lineup</strong> (ou{" "}
                  <strong>Lineup</strong> se já existir). Atribui as 6
                  jogadoras às posições P1–P6 do início do set. A rotação
                  começa em P1.
                </p>
              </div>
              <div>
                <div className="font-semibold mb-1">Substituições</div>
                <p className="text-xs text-muted-foreground">
                  Carrega em <strong>Subs</strong> e escolhe quem entra e
                  quem sai. As substituições aplicam-se cronologicamente
                  sobre o lineup inicial — o campo actualiza
                  automaticamente.
                </p>
              </div>
              <div>
                <div className="font-semibold mb-1">Saque & rotação</div>
                <p className="text-xs text-muted-foreground">
                  O ícone de bola âmbar marca quem está a servir. Quando
                  fazemos <strong>side-out</strong> (ganhamos o rally a
                  receber), a rotação avança automaticamente +1 e o saque
                  passa para nós. Se algo correr mal, podes corrigir
                  manualmente: clica no ícone de bola para alterar o
                  servidor, ou na seta de rotação ao lado de "Rot."
                </p>
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                💡 Em novo set, o lineup pode mudar. O sistema guarda
                lineups separados por set.
              </div>
            </div>
          </TabsContent>

          {/* ── FAQ ──────────────────────────────────────────────────── */}
          <TabsContent value="faq">
            <ul className="space-y-3">
              {FAQ.map((item, i) => (
                <li key={i} className="border-b last:border-0 pb-3 last:pb-0">
                  <div className="font-semibold text-sm mb-1">{item.q}</div>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    {item.a}
                  </div>
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
