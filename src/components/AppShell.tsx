import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarDays,
  ListChecks,
  MoreHorizontal,
  Settings,
  Sparkles,
  Sun,
  Target,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/today", label: "Today", icon: Sun },
  { to: "/plan", label: "Plan", icon: ListChecks },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/review", label: "Review", icon: Sparkles },
  { to: "/insights", label: "Insights", icon: BarChart3 },
] as const;

/** Bottom bar keeps the five daily-driver tabs; the rest live behind "More". */
const MOBILE_PRIMARY = ["/today", "/plan", "/goals", "/review"] as const;
const MOBILE_MORE = [
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/insights", label: "Insights", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border/60 bg-sidebar/60 px-4 py-6 backdrop-blur-xl md:flex">
        <Link to="/today" className="mb-9 flex items-center gap-2.5 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-primary-glow text-primary-foreground shadow-soft">
            <Sun className="h-4.5 w-4.5" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">SuperFlow</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                pathname === to
                  ? "glass sheen text-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 transition-colors",
                  pathname === to ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                )}
              />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto">
          <Link
            to="/settings"
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
              pathname === "/settings"
                ? "glass sheen text-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
            )}
          >
            <Settings className={cn("h-4 w-4", pathname === "/settings" && "text-primary")} />
            Settings
          </Link>
        </div>
      </aside>

      <main className="flex-1 pb-28 md:pb-12">
        <header className="sticky top-0 z-10 border-b border-border/50 bg-background/70 px-5 py-5 backdrop-blur-xl md:px-8">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate font-display text-2xl font-semibold tracking-tight md:text-3xl">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
            {action}
          </div>
        </header>
        <div className="mx-auto max-w-4xl px-5 py-7 md:px-8">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border/50 bg-background/80 px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl md:hidden">
        {NAV.filter((item) => (MOBILE_PRIMARY as readonly string[]).includes(item.to)).map(
          ({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition-colors",
                pathname === to ? "bg-secondary/70 text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ),
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition-colors",
              MOBILE_MORE.some((i) => i.to === pathname)
                ? "bg-secondary/70 text-primary"
                : "text-muted-foreground",
            )}
            aria-label="More sections"
          >
            <MoreHorizontal className="h-5 w-5" />
            More
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="mb-2 w-44 rounded-2xl">
            {MOBILE_MORE.map(({ to, label, icon: Icon }) => (
              <DropdownMenuItem key={to} asChild>
                <Link to={to} className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </div>
  );
}
