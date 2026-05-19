import { Link } from "wouter";
import { LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { logout } from "@/lib/firebase";

export function TopBar() {
  const { user } = useAuth();

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 md:px-6">
      <div className="lg:hidden font-semibold">VolleyIQ</div>
      <div className="hidden lg:block text-sm text-muted-foreground">
        Bem-vinda de volta — vamos ler o jogo.
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/profile"
          className="hidden sm:flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
          title="Perfil"
        >
          <div className="h-7 w-7 rounded-full bg-secondary grid place-items-center">
            <UserIcon className="h-4 w-4" />
          </div>
          <span className="text-muted-foreground">
            {user?.displayName ?? user?.email ?? "Utilizador"}
          </span>
        </Link>

        <ThemeToggle />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => logout()}
          aria-label="Sair"
        >
          <LogOut className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only sm:ml-2">Sair</span>
        </Button>
      </div>
    </header>
  );
}
