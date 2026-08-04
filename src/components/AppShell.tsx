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
    <div className="min-h-screen bg-background md:flex">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar px-4 py-6 md:flex">
        <Link to="/today" className="mb-8 flex items-center gap-2 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sun className="h-4 w-4" />
          </span>
          <span className="font-display text-2xl">DayFlow</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === to
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto">
          <Link
            to="/settings"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              pathname === "/settings"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </aside>

      <main className="flex-1 pb-24 md:pb-10">
        <header className="sticky top-0 z-10 border-b border-border/70 bg-background/85 px-5 py-4 backdrop-blur md:px-8">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl leading-tight md:text-4xl">{title}</h1>
              {subtitle ? (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
            {action}
          </div>
        </header>
        <div className="mx-auto max-w-4xl px-5 py-6 md:px-8">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-background/95 backdrop-blur md:hidden">
        {NAV.filter((item) => (MOBILE_PRIMARY as readonly string[]).includes(item.to)).map(
          ({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                pathname === to ? "text-primary" : "text-muted-foreground",
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
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
              MOBILE_MORE.some((i) => i.to === pathname) ? "text-primary" : "text-muted-foreground",
            )}
            aria-label="More sections"
          >
            <MoreHorizontal className="h-5 w-5" />
            More
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="mb-1 w-44">
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
