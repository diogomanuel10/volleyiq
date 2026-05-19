import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Check, Key, Plus, Trash2, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { api } from "@/lib/api";
import { useTeam } from "@/hooks/useTeam";
import { usePlanGuard } from "@/hooks/usePlanGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ApiKeyRecord {
  id: string;
  teamId: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

interface CreateApiKeyResponse {
  key: string;
  record: ApiKeyRecord;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copiado!" : "Copiar"}
    </Button>
  );
}

export default function ApiKeysPage() {
  const { team } = useTeam();
  const guard = usePlanGuard();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<{ key: string; record: ApiKeyRecord } | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const isPro = guard.meetsMinimum("pro");

  const keysQuery = useQuery({
    queryKey: ["api-keys", team?.id],
    queryFn: () => api.get<ApiKeyRecord[]>(`/api/teams/${team!.id}/api-keys`),
    enabled: !!team && isPro,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      api.post<CreateApiKeyResponse>(`/api/teams/${team!.id}/api-keys`, { name }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["api-keys", team?.id] });
      setCreateOpen(false);
      setNewKeyName("");
      setCreatedKey(data);
    },
    onError: (err: any) => {
      if (err?.body?.error === "max_keys_reached") {
        toast.error("Limite de 5 chaves atingido. Revoga uma para criar uma nova.");
      } else {
        toast.error("Erro ao criar chave de API.");
      }
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) =>
      api.delete(`/api/teams/${team!.id}/api-keys/${keyId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-keys", team?.id] });
      setRevokeId(null);
      toast.success("Chave revogada com sucesso.");
    },
    onError: () => {
      toast.error("Erro ao revogar chave.");
    },
  });

  if (!team) return null;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Key className="h-6 w-6 text-primary" />
          Chaves de API
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Acede aos dados da tua equipa programaticamente
        </p>
      </header>

      {/* Plan gate */}
      {!isPro ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-6 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
          <p className="font-semibold">Plano Pro ou superior necessário</p>
          <p className="text-sm text-muted-foreground">
            As Chaves de API estão disponíveis a partir do plano Pro.
          </p>
          <Button asChild>
            <Link href="/pricing">Ver planos</Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Create button */}
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Máximo de 5 chaves activas.
            </p>
            <Button
              onClick={() => setCreateOpen(true)}
              className="gap-2"
              disabled={(keysQuery.data?.length ?? 0) >= 5}
            >
              <Plus className="h-4 w-4" />
              Nova Chave
            </Button>
          </div>

          {/* Keys table */}
          {keysQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">A carregar…</p>
          ) : keysQuery.data?.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
              Ainda não tens chaves de API. Cria a primeira acima.
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Nome</th>
                    <th className="text-left px-4 py-2 font-medium">Prefixo</th>
                    <th className="text-left px-4 py-2 font-medium hidden sm:table-cell">Criada em</th>
                    <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Último uso</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {keysQuery.data?.map((k) => (
                    <tr key={k.id} className="border-t">
                      <td className="px-4 py-3 font-medium">{k.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {k.keyPrefix}…
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        {new Date(k.createdAt).toLocaleDateString("pt-PT")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {k.lastUsedAt
                          ? new Date(k.lastUsedAt).toLocaleDateString("pt-PT")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive gap-1"
                          onClick={() => setRevokeId(k.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="hidden sm:inline">Revogar</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Code snippet */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Exemplo de utilização</p>
            <div className="rounded-lg bg-muted p-4 font-mono text-xs text-muted-foreground overflow-x-auto">
              <pre>{`curl https://api.volleyiq.com/api/public/v1/team \\
  -H "Authorization: Bearer <chave>"`}</pre>
            </div>
          </div>
        </>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Chave de API</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="key-name">Nome da chave</Label>
              <Input
                id="key-name"
                placeholder="ex: Integração website"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newKeyName.trim()) {
                    createMutation.mutate(newKeyName.trim());
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createMutation.mutate(newKeyName.trim())}
              disabled={!newKeyName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "A criar…" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show new key dialog */}
      <Dialog open={!!createdKey} onOpenChange={() => setCreatedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chave criada com sucesso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 flex gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <span className="text-amber-700 dark:text-amber-300">
                Copia a chave agora — só é mostrada uma vez e não pode ser recuperada depois.
              </span>
            </div>
            <div className="space-y-2">
              <Label>A tua chave de API</Label>
              <div className="flex gap-2 items-center">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">
                  {createdKey?.key}
                </code>
                {createdKey && <CopyButton text={createdKey.key} />}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedKey(null)}>
              Já copiei, fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation dialog */}
      <Dialog open={!!revokeId} onOpenChange={() => setRevokeId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revogar chave?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Esta acção é irreversível. Qualquer integração que use esta chave deixará de funcionar imediatamente.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => revokeId && revokeMutation.mutate(revokeId)}
              disabled={revokeMutation.isPending}
            >
              {revokeMutation.isPending ? "A revogar…" : "Revogar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
