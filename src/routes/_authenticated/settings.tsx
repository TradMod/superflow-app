import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, LogOut, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { categoriesQuery, currentUserId, profileQuery } from "@/lib/queries";
import { useTheme, type ThemeName } from "@/lib/theme";
import { cn } from "@/lib/utils";

const THEMES: {
  value: ThemeName;
  label: string;
  description: string;
  preview: string;
  swatches: string[];
}[] = [
  {
    value: "dark",
    label: "Midnight",
    description: "Premium near-black with soft glass depth.",
    preview: "linear-gradient(140deg, #17171c 0%, #201f27 55%, #2a222c 100%)",
    swatches: ["#17171c", "#2a2731", "#f0a8c6"],
  },
  {
    value: "pink",
    label: "Mauve Ink",
    description: "Light greige base with a muted mauve accent.",
    preview: "linear-gradient(140deg, #f7f5f7 0%, #ece5ea 55%, #dccbd6 100%)",
    swatches: ["#f7f5f7", "#e6dfe6", "#a5748c"],
  },
];


export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — SuperFlow" },
      { name: "description", content: "Manage your SuperFlow profile and categories." },
      { property: "og:title", content: "Settings — SuperFlow" },
      { property: "og:description", content: "Manage your SuperFlow profile and categories." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const profile = useQuery(profileQuery());
  const categories = useQuery(categoriesQuery());
  const [name, setName] = useState("");
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => {
    if (profile.data?.display_name) setName(profile.data.display_name);
  }, [profile.data?.display_name]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const userId = await currentUserId();
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: name.trim().slice(0, 80) })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addCategory = useMutation({
    mutationFn: async () => {
      if (!newCategory.trim()) throw new Error("Name your category.");
      const userId = await currentUserId();
      const { error } = await supabase
        .from("categories")
        .insert({ user_id: userId, name: newCategory.trim().slice(0, 40) });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["categories"] });
      setNewCategory("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["categories"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <AppShell title="Settings" subtitle="Appearance, profile and categories">
      <div className="panel sheen p-5">
        <h2 className="font-display text-lg font-semibold">Appearance</h2>
        <p className="mt-1 text-sm text-muted-foreground">Pick the look that suits you.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTheme(t.value)}
              aria-pressed={theme === t.value}
              className={cn(
                "group rounded-2xl border p-3 text-left transition-all duration-200",
                theme === t.value
                  ? "border-primary/60 shadow-lift"
                  : "border-border hover:border-primary/40",
              )}
            >
              <span
                className="flex h-20 items-end rounded-xl p-3"
                style={{ background: t.preview }}
              >
                <span className="flex gap-1.5">
                  {t.swatches.map((c) => (
                    <span
                      key={c}
                      className="h-4 w-4 rounded-full ring-1 ring-black/10"
                      style={{ background: c }}
                    />
                  ))}
                </span>
              </span>
              <span className="mt-3 flex items-center justify-between">
                <span className="text-sm font-medium">{t.label}</span>
                {theme === t.value ? <Check className="h-4 w-4 text-primary" /> : null}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{t.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="panel sheen mt-4 p-5">
        <h2 className="mb-3 font-display text-lg font-semibold">Profile</h2>
        <div className="space-y-1.5">
          <Label htmlFor="name">Display name</Label>
          <Input id="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button className="mt-4" disabled={saveProfile.isPending} onClick={() => saveProfile.mutate()}>
          Save
        </Button>
      </div>

      <div className="panel sheen mt-4 p-5">
        <h2 className="mb-3 font-display text-lg font-semibold">Categories</h2>
        <ul className="space-y-2">
          {(categories.data ?? []).map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-xl border border-border/70 bg-secondary/30 p-3 text-sm"
            >
              <span>{c.name}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${c.name}`}
                onClick={() => removeCategory.mutate(c.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <Input
            maxLength={40}
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Fitness"
          />
          <Button variant="outline" onClick={() => addCategory.mutate()} aria-label="Add category">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Button variant="outline" className="mt-6" onClick={signOut}>
        <LogOut className="mr-1 h-4 w-4" /> Sign out
      </Button>
    </AppShell>
  );
}
