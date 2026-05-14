import { useState, useRef, useEffect } from "react";
import { LogOut, User as UserIcon, Globe, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage, LANGUAGE_LABEL, LANGUAGE_SHORT, type Language } from "@/hooks/useLanguage";
import { logout } from "@/lib/firebase";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

function LanguageSelector() {
  const { t } = useTranslation();
  const { language, setLanguage, supported } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="sm"
        aria-label={t("topbar.language")}
        onClick={() => setOpen((v) => !v)}
        className="gap-1"
      >
        <Globe className="h-4 w-4" />
        <span className="text-xs font-mono font-semibold">
          {LANGUAGE_SHORT[language] ?? language.toUpperCase().slice(0, 2)}
        </span>
        <ChevronDown className="h-3 w-3" />
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[130px] rounded-md border bg-card shadow-md py-1">
          {supported.map((lang) => (
            <button
              key={lang}
              onClick={() => {
                setLanguage(lang as Language);
                setOpen(false);
              }}
              className={cn(
                "w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors",
                language === lang && "font-semibold text-primary",
              )}
            >
              {LANGUAGE_LABEL[lang as Language]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TopBar() {
  const { user } = useAuth();
  const { t } = useTranslation();

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 md:px-6">
      <div className="lg:hidden font-semibold">VolleyIQ</div>
      <div className="hidden lg:block text-sm text-muted-foreground">
        {t("topbar.welcome")}
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 text-sm">
          <div className="h-7 w-7 rounded-full bg-secondary grid place-items-center">
            <UserIcon className="h-4 w-4" />
          </div>
          <span className="text-muted-foreground">
            {user?.displayName ?? user?.email ?? t("topbar.user")}
          </span>
        </div>

        <LanguageSelector />

        <ThemeToggle />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => logout()}
          aria-label={t("topbar.logout")}
        >
          <LogOut className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only sm:ml-2">{t("topbar.logout")}</span>
        </Button>
      </div>
    </header>
  );
}
