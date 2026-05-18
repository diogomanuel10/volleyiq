import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  TrendingDown,
  TrendingUp,
  User,
  RotateCcw,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type InsightLevel = "positive" | "warning" | "alert" | "info";
type InsightCategory = "team" | "player" | "rotation" | "trend";

interface Insight {
  id: string;
  level: InsightLevel;
  category: InsightCategory;
  title: string;
  body: string;
}

const LEVEL_STYLE: Record<InsightLevel, string> = {
  alert:    "border-red-400/50 bg-red-50 dark:bg-red-950/20",
  warning:  "border-amber-400/50 bg-amber-50 dark:bg-amber-950/20",
  positive: "border-emerald-400/50 bg-emerald-50 dark:bg-emerald-950/20",
  info:     "border-sky-400/50 bg-sky-50 dark:bg-sky-950/20",
};

const LEVEL_ICON_COLOR: Record<InsightLevel, string> = {
  alert:    "text-red-500",
  warning:  "text-amber-500",
  positive: "text-emerald-600",
  info:     "text-sky-500",
};

const LEVEL_TITLE_COLOR: Record<InsightLevel, string> = {
  alert:    "text-red-700 dark:text-red-400",
  warning:  "text-amber-700 dark:text-amber-400",
  positive: "text-emerald-700 dark:text-emerald-400",
  info:     "text-sky-700 dark:text-sky-400",
};

function LevelIcon({
  level,
  category,
}: {
  level: InsightLevel;
  category: InsightCategory;
}) {
  const cls = cn("h-4 w-4 shrink-0 mt-0.5", LEVEL_ICON_COLOR[level]);
  if (level === "alert") return <AlertTriangle className={cls} />;
  if (level === "warning" && category === "trend") return <TrendingDown className={cls} />;
  if (level === "positive" && category === "trend") return <TrendingUp className={cls} />;
  if (level === "positive") return <CheckCircle2 className={cls} />;
  if (category === "player") return <User className={cls} />;
  if (category === "rotation") return <RotateCcw className={cls} />;
  if (category === "team") return <Zap className={cls} />;
  return <Info className={cls} />;
}

export function InsightsPanel({ teamId }: { teamId: string }) {
  const query = useQuery<Insight[]>({
    queryKey: ["insights", teamId],
    queryFn: () => api.get(`/api/stats/team/${teamId}/insights`),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(teamId),
  });

  if (query.isLoading) {
    return (
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Insights
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </section>
    );
  }

  const insights = query.data ?? [];
  if (insights.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Insights automáticos
        </h2>
        <span className="ml-auto text-xs text-muted-foreground">
          Atualizado com os últimos jogos
        </span>
      </div>

      <AnimatePresence>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {insights.map((insight, i) => (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "rounded-xl border p-4 flex gap-3",
                LEVEL_STYLE[insight.level],
              )}
            >
              <LevelIcon level={insight.level} category={insight.category} />
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm font-semibold leading-snug",
                    LEVEL_TITLE_COLOR[insight.level],
                  )}
                >
                  {insight.title}
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {insight.body}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
    </section>
  );
}
