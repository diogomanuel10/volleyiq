import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, Send, ChevronDown, ChevronUp, Bot } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Qual é a nossa melhor rotação?",
  "Quem está em melhor forma no ataque?",
  "Como está a nossa receção nas últimas partidas?",
];

export function DataChat({
  teamId,
  isPro,
}: {
  teamId: string;
  isPro: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isMock, setIsMock] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  const mutation = useMutation({
    mutationFn: ({
      question,
      history,
    }: {
      question: string;
      history: ChatMessage[];
    }) =>
      api.post<{ answer: string; mock?: boolean }>("/api/ai/chat", {
        teamId,
        question,
        history,
      }),
    onSuccess: (data, vars) => {
      if (data.mock) setIsMock(true);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: vars.question },
        { role: "assistant", content: data.answer },
      ]);
      setInput("");
    },
    onError: (err: any) => {
      if (err?.status === 403 && err?.body?.error === "plan_required") {
        toast.error("Funcionalidade disponível nos planos Pro e Club.");
      } else {
        toast.error("Erro ao contactar o analista IA. Tente novamente.");
      }
    },
  });

  function sendQuestion(question: string) {
    if (!question.trim() || mutation.isPending) return;
    // Keep last 10 messages for history
    const history = messages.slice(-10);
    mutation.mutate({ question: question.trim(), history });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendQuestion(input);
  }

  return (
    <Card className="mt-4">
      {/* Header — always visible, clickable */}
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Analista IA
            <Badge variant="outline" className="text-xs font-normal">
              Beta
            </Badge>
            {isMock && (
              <Badge variant="secondary" className="text-xs font-normal text-amber-600 border-amber-300">
                Demo
              </Badge>
            )}
          </CardTitle>
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        {!open && (
          <p className="text-sm text-muted-foreground mt-1">
            Perguntar sobre os dados
          </p>
        )}
      </CardHeader>

      {open && (
        <CardContent className="space-y-4">
          {/* Plan gate */}
          {!isPro && (
            <div className="rounded-md border border-dashed p-4 text-sm text-center text-muted-foreground">
              Disponível nos planos{" "}
              <span className="font-semibold text-foreground">Pro</span> e{" "}
              <span className="font-semibold text-foreground">Club</span>.{" "}
              <a href="/pricing" className="underline text-primary">
                Ver planos
              </a>
            </div>
          )}

          {isPro && (
            <>
              {/* Suggestion chips */}
              {messages.length === 0 && (
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => sendQuestion(s)}
                      disabled={mutation.isPending}
                      className="rounded-full border px-3 py-1 text-xs hover:bg-accent transition-colors disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Messages */}
              {messages.length > 0 && (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex gap-2",
                        msg.role === "user" ? "justify-end" : "justify-start",
                      )}
                    >
                      {msg.role === "assistant" && (
                        <div className="mt-0.5 shrink-0">
                          <Bot className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "rounded-lg px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap",
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground",
                        )}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}

                  {/* Loading bubble */}
                  {mutation.isPending && (
                    <div className="flex gap-2 justify-start">
                      <div className="mt-0.5 shrink-0">
                        <Bot className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="bg-muted rounded-lg px-3 py-2">
                        <Skeleton className="h-4 w-32" />
                        <p className="text-xs text-muted-foreground mt-1">
                          A analisar...
                        </p>
                      </div>
                    </div>
                  )}

                  <div ref={bottomRef} />
                </div>
              )}

              {/* Suggestions after first exchange */}
              {messages.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => sendQuestion(s)}
                      disabled={mutation.isPending}
                      className="rounded-full border px-3 py-1 text-xs hover:bg-accent transition-colors disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <form
                onSubmit={handleSubmit}
                className="flex gap-2 items-end"
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendQuestion(input);
                    }
                  }}
                  placeholder="Escreve a tua pergunta..."
                  rows={2}
                  maxLength={1000}
                  disabled={mutation.isPending}
                  className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!input.trim() || mutation.isPending}
                  className="shrink-0"
                >
                  <Send className="h-4 w-4" />
                  <span className="ml-1">Enviar</span>
                </Button>
              </form>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
