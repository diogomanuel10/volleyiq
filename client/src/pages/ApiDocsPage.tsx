import { useState } from "react";
import { Check, Copy, Code2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type Lang = "curl" | "python" | "javascript";

interface CodeExample {
  curl: string;
  python: string;
  javascript: string;
}

interface EndpointDef {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  description: string;
  code: CodeExample;
  response: string;
}

// ─── Data ────────────────────────────────────────────────────────────────────

const BASE = "https://volleyiq.app/api/public/v1";

const ENDPOINTS: EndpointDef[] = [
  {
    method: "GET",
    path: "/team",
    description: "Devolve os detalhes da tua equipa.",
    code: {
      curl: `curl ${BASE}/team \\\n  -H "Authorization: Bearer viq_..."`,
      python: `import requests\nr = requests.get(\n    "${BASE}/team",\n    headers={"Authorization": "Bearer viq_..."}\n)\nteam = r.json()`,
      javascript: `const res = await fetch("${BASE}/team", {\n  headers: { Authorization: "Bearer viq_..." }\n});\nconst team = await res.json();`,
    },
    response: JSON.stringify(
      {
        id: "team_xyz",
        name: "Sporting CP Feminino",
        club: "Sporting CP",
        category: "Sénior Feminino",
        season: "2023/24",
      },
      null,
      2,
    ),
  },
  {
    method: "GET",
    path: "/matches",
    description: "Lista todos os jogos da equipa, ordenados por data.",
    code: {
      curl: `curl ${BASE}/matches \\\n  -H "Authorization: Bearer viq_..."`,
      python: `import requests\nr = requests.get(\n    "${BASE}/matches",\n    headers={"Authorization": "Bearer viq_..."}\n)\nmatches = r.json()`,
      javascript: `const res = await fetch("${BASE}/matches", {\n  headers: { Authorization: "Bearer viq_..." }\n});\nconst matches = await res.json();`,
    },
    response: JSON.stringify(
      [
        {
          id: "m_abc123",
          opponent: "Benfica",
          date: "2024-03-15T19:00:00Z",
          setsWon: 3,
          setsLost: 1,
          status: "finished",
          competition: "Liga Nacional",
        },
      ],
      null,
      2,
    ),
  },
  {
    method: "GET",
    path: "/players",
    description: "Lista todas as jogadoras do plantel com posições e números.",
    code: {
      curl: `curl ${BASE}/players \\\n  -H "Authorization: Bearer viq_..."`,
      python: `import requests\nr = requests.get(\n    "${BASE}/players",\n    headers={"Authorization": "Bearer viq_..."}\n)\nplayers = r.json()`,
      javascript: `const res = await fetch("${BASE}/players", {\n  headers: { Authorization: "Bearer viq_..." }\n});\nconst players = await res.json();`,
    },
    response: JSON.stringify(
      [
        {
          id: "p_001",
          name: "Ana Silva",
          number: 7,
          position: "outside",
          active: true,
        },
        {
          id: "p_002",
          name: "Marta Costa",
          number: 12,
          position: "setter",
          active: true,
        },
      ],
      null,
      2,
    ),
  },
  {
    method: "GET",
    path: "/stats/kpis",
    description: "Devolve os KPIs agregados da equipa para a época atual.",
    code: {
      curl: `curl ${BASE}/stats/kpis \\\n  -H "Authorization: Bearer viq_..."`,
      python: `import requests\nr = requests.get(\n    "${BASE}/stats/kpis",\n    headers={"Authorization": "Bearer viq_..."}\n)\nkpis = r.json()`,
      javascript: `const res = await fetch("${BASE}/stats/kpis", {\n  headers: { Authorization: "Bearer viq_..." }\n});\nconst kpis = await res.json();`,
    },
    response: JSON.stringify(
      {
        killPct: 44.5,
        sideOutPct: 62.1,
        passRating: 2.18,
        serveAcePct: 8.3,
        attackEfficiency: 0.285,
        record: "12-4",
        sampleMatches: 16,
        sampleActions: 3842,
      },
      null,
      2,
    ),
  },
  {
    method: "GET",
    path: "/stats/players",
    description: "Estatísticas individuais por jogadora.",
    code: {
      curl: `curl ${BASE}/stats/players \\\n  -H "Authorization: Bearer viq_..."`,
      python: `import requests\nr = requests.get(\n    "${BASE}/stats/players",\n    headers={"Authorization": "Bearer viq_..."}\n)\nstats = r.json()`,
      javascript: `const res = await fetch("${BASE}/stats/players", {\n  headers: { Authorization: "Bearer viq_..." }\n});\nconst stats = await res.json();`,
    },
    response: JSON.stringify(
      [
        {
          playerId: "p_001",
          name: "Ana Silva",
          killPct: 52.3,
          attackEfficiency: 0.341,
          serveAcePct: 11.2,
          passRating: 2.35,
          actions: 412,
        },
      ],
      null,
      2,
    ),
  },
  {
    method: "GET",
    path: "/actions",
    description: "Lista de ações individuais registadas (serve, ataque, receção, …).",
    code: {
      curl: `curl "${BASE}/actions?matchId=m_abc123" \\\n  -H "Authorization: Bearer viq_..."`,
      python: `import requests\nr = requests.get(\n    "${BASE}/actions",\n    params={"matchId": "m_abc123"},\n    headers={"Authorization": "Bearer viq_..."}\n)\nactions = r.json()`,
      javascript: `const res = await fetch(\n  "${BASE}/actions?matchId=m_abc123",\n  { headers: { Authorization: "Bearer viq_..." } }\n);\nconst actions = await res.json();`,
    },
    response: JSON.stringify(
      [
        {
          id: "a_001",
          matchId: "m_abc123",
          playerId: "p_001",
          type: "attack",
          outcome: "kill",
          set: 1,
          rotation: 2,
          timestamp: "2024-03-15T19:12:34Z",
        },
      ],
      null,
      2,
    ),
  },
];

const WEBHOOK_PAYLOAD = JSON.stringify(
  {
    event: "match.finished",
    teamId: "team_xyz",
    match: {
      id: "m_abc123",
      opponent: "Benfica",
      date: "2024-03-15T19:00:00Z",
      setsWon: 3,
      setsLost: 1,
      result: "win",
      competition: "Liga Nacional",
    },
    kpis: {
      killPct: 44.5,
      sideOutPct: 62.1,
      passRating: 2.18,
      serveAcePct: 8.3,
      attackEfficiency: 0.285,
      record: "12-4",
    },
    sentAt: "2024-03-15T20:30:00Z",
  },
  null,
  2,
);

const HMAC_VERIFY = `import hmac, hashlib

def verify(secret: str, body: bytes, signature: str) -> bool:
    expected = "sha256=" + hmac.new(
        secret.encode(), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)`;

// ─── Sidebar sections ─────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "introducao", label: "Introdução" },
  { id: "autenticacao", label: "Autenticação" },
  { id: "endpoints", label: "Endpoints" },
  { id: "get-team", label: "GET /team", indent: true },
  { id: "get-matches", label: "GET /matches", indent: true },
  { id: "get-players", label: "GET /players", indent: true },
  { id: "get-stats-kpis", label: "GET /stats/kpis", indent: true },
  { id: "get-stats-players", label: "GET /stats/players", indent: true },
  { id: "get-actions", label: "GET /actions", indent: true },
  { id: "webhooks", label: "Webhooks" },
  { id: "webhook-payload", label: "Payload", indent: true },
  { id: "webhook-hmac", label: "Verificação HMAC", indent: true },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors px-2 py-1 rounded hover:bg-zinc-700"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copiado!" : "Copiar"}
    </button>
  );
}

function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
  return (
    <div className="relative rounded-lg bg-zinc-900 border border-zinc-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-700 bg-zinc-800">
        <span className="text-xs text-zinc-500 font-mono">{lang}</span>
        <CopyButton text={code} />
      </div>
      <pre className="p-4 text-sm text-zinc-100 font-mono overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function MethodBadge({ method }: { method: "GET" | "POST" | "PUT" | "DELETE" }) {
  const colors: Record<string, string> = {
    GET: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    POST: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    PUT: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    DELETE: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-xs font-mono font-semibold",
        colors[method],
      )}
    >
      {method}
    </span>
  );
}

function TabbedCode({ code }: { code: CodeExample }) {
  const [lang, setLang] = useState<Lang>("curl");
  const langs: { key: Lang; label: string }[] = [
    { key: "curl", label: "curl" },
    { key: "python", label: "Python" },
    { key: "javascript", label: "JavaScript" },
  ];
  return (
    <div className="rounded-lg bg-zinc-900 border border-zinc-700 overflow-hidden">
      <div className="flex items-center gap-0 border-b border-zinc-700 bg-zinc-800 px-2">
        {langs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setLang(key)}
            className={cn(
              "px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px",
              lang === key
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-zinc-500 hover:text-zinc-300",
            )}
          >
            {label}
          </button>
        ))}
        <div className="ml-auto">
          <CopyButton text={code[lang]} />
        </div>
      </div>
      <pre className="p-4 text-sm text-zinc-100 font-mono overflow-x-auto leading-relaxed">
        <code>{code[lang]}</code>
      </pre>
    </div>
  );
}

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2 scroll-mt-6">
      {children}
    </h2>
  );
}

function EndpointSection({ endpoint, sectionId }: { endpoint: EndpointDef; sectionId: string }) {
  return (
    <section id={sectionId} className="scroll-mt-6 space-y-4">
      <div className="flex items-center gap-3">
        <MethodBadge method={endpoint.method} />
        <code className="text-base font-mono text-zinc-800 dark:text-zinc-200">
          {endpoint.path}
        </code>
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{endpoint.description}</p>
      <TabbedCode code={endpoint.code} />
      <div>
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
          Resposta de exemplo
        </p>
        <CodeBlock code={endpoint.response} lang="json" />
      </div>
    </section>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ApiDocsPage() {
  const [activeSection, setActiveSection] = useState("introducao");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeLabel = SECTIONS.find((s) => s.id === activeSection)?.label ?? "Introdução";

  function navClick(id: string) {
    setActiveSection(id);
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <div className="h-7 w-7 rounded-md bg-blue-600 text-white grid place-items-center font-bold text-sm shrink-0">
            V
          </div>
          <span className="font-semibold text-sm">VolleyIQ</span>
          <span className="text-zinc-400 text-sm">/</span>
          <span className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
            <Code2 className="h-4 w-4" />
            Referência da API
          </span>
          <div className="ml-auto">
            <a
              href="/#/settings/api-keys"
              className="text-xs text-blue-600 hover:underline"
            >
              Criar chave de API →
            </a>
          </div>
        </div>
      </header>

      {/* Mobile nav dropdown */}
      <div className="lg:hidden border-b border-zinc-200 dark:border-zinc-800 px-4 py-2">
        <button
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300"
        >
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", mobileMenuOpen && "rotate-180")}
          />
          {activeLabel}
        </button>
        {mobileMenuOpen && (
          <nav className="mt-2 space-y-0.5 pb-2">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => navClick(s.id)}
                className={cn(
                  "w-full text-left text-sm px-2 py-1.5 rounded transition-colors",
                  s.indent ? "pl-5 text-zinc-500" : "font-medium",
                  activeSection === s.id
                    ? "bg-blue-50 dark:bg-blue-950 text-blue-600"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300",
                )}
              >
                {s.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      <div className="max-w-7xl mx-auto flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-60 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto border-r border-zinc-200 dark:border-zinc-800 py-6 px-4">
          <nav className="space-y-0.5">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => navClick(s.id)}
                className={cn(
                  "w-full text-left text-sm px-2 py-1.5 rounded transition-colors",
                  s.indent ? "pl-5 text-zinc-500 dark:text-zinc-500" : "font-medium",
                  activeSection === s.id
                    ? "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200",
                )}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 px-6 lg:px-12 py-10 space-y-14 max-w-3xl">
          {/* Introdução */}
          <section id="introducao" className="scroll-mt-6 space-y-4">
            <SectionTitle id="introducao-title">Introdução</SectionTitle>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              A API VolleyIQ permite aceder programaticamente aos dados da tua equipa —
              jogos, jogadoras, ações e estatísticas — para integrar com as tuas ferramentas,
              dashboards externos ou pipelines de dados.
            </p>
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-3 text-sm font-mono text-zinc-700 dark:text-zinc-300">
              Base URL:{" "}
              <span className="text-blue-600 dark:text-blue-400">
                https://volleyiq.app/api/public/v1
              </span>
            </div>
          </section>

          {/* Autenticação */}
          <section id="autenticacao" className="scroll-mt-6 space-y-4">
            <SectionTitle id="autenticacao-title">Autenticação</SectionTitle>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Todas as rotas requerem um token de portador no cabeçalho{" "}
              <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-sm font-mono">
                Authorization
              </code>
              . Cria as tuas chaves em{" "}
              <a
                href="/#/settings/api-keys"
                className="text-blue-600 hover:underline"
              >
                Definições → Chaves de API
              </a>{" "}
              (requer plano Pro).
            </p>
            <CodeBlock
              code={`curl https://volleyiq.app/api/public/v1/team \\\n  -H "Authorization: Bearer viq_..."`}
              lang="bash"
            />
          </section>

          {/* Endpoints heading */}
          <section id="endpoints" className="scroll-mt-6 space-y-2">
            <SectionTitle id="endpoints-title">Endpoints</SectionTitle>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm">
              Todos os endpoints devolvem JSON. Erros seguem o formato{" "}
              <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-sm font-mono">
                {"{ error: string }"}
              </code>
              .
            </p>
          </section>

          {/* Individual endpoints */}
          {ENDPOINTS.map((ep, i) => {
            const ids = [
              "get-team",
              "get-matches",
              "get-players",
              "get-stats-kpis",
              "get-stats-players",
              "get-actions",
            ];
            return (
              <EndpointSection key={ep.path} endpoint={ep} sectionId={ids[i]} />
            );
          })}

          {/* Webhooks */}
          <section id="webhooks" className="scroll-mt-6 space-y-4">
            <SectionTitle id="webhooks-title">Webhooks</SectionTitle>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              O VolleyIQ envia pedidos HTTP POST para o teu endpoint configurado sempre que
              ocorrem eventos relevantes (ex: fim de jogo). Configura o teu webhook em{" "}
              <a href="/#/settings/webhooks" className="text-blue-600 hover:underline">
                Definições → Webhooks
              </a>
              .
            </p>
          </section>

          <section id="webhook-payload" className="scroll-mt-6 space-y-4">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Payload
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Exemplo de payload enviado no evento{" "}
              <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-mono">
                match.finished
              </code>
              :
            </p>
            <CodeBlock code={WEBHOOK_PAYLOAD} lang="json" />
          </section>

          <section id="webhook-hmac" className="scroll-mt-6 space-y-4">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Verificação HMAC
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Cada pedido inclui o cabeçalho{" "}
              <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-mono">
                X-VolleyIQ-Signature
              </code>{" "}
              com uma assinatura HMAC-SHA256. Verifica-a para garantir autenticidade:
            </p>
            <CodeBlock code={HMAC_VERIFY} lang="python" />
          </section>

          {/* Footer */}
          <footer className="pt-8 border-t border-zinc-200 dark:border-zinc-800 text-sm text-zinc-500 dark:text-zinc-500">
            <p>
              Dúvidas? Contacta-nos em{" "}
              <a
                href="mailto:suporte@volleyiq.app"
                className="text-blue-600 hover:underline"
              >
                suporte@volleyiq.app
              </a>
              .
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
