import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeName = "dark" | "pink";

const STORAGE_KEY = "superflow-theme";
const DEFAULT_THEME: ThemeName = "dark";

/** Runs before paint in the document head so the first frame is already themed. */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)});if(t!=="pink"&&t!=="dark"){t=${JSON.stringify(DEFAULT_THEME)};}var e=document.documentElement;e.classList.toggle("dark",t==="dark");e.setAttribute("data-theme",t);}catch(_){}})();`;

function applyTheme(theme: ThemeName) {
  const el = document.documentElement;
  el.classList.toggle("dark", theme === "dark");
  el.setAttribute("data-theme", theme);
}

const ThemeContext = createContext<{
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}>({ theme: DEFAULT_THEME, setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(DEFAULT_THEME);

  // Read the persisted choice after hydration so SSR markup stays stable.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const next: ThemeName = stored === "pink" || stored === "dark" ? stored : DEFAULT_THEME;
    setThemeState(next);
    applyTheme(next);
  }, []);

  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage can be unavailable in private modes */
    }
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
