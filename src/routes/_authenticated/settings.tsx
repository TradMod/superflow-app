import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LogOut, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { categoriesQuery, currentUserId, profileQuery } from "@/lib/queries";

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
    <AppShell title="Settings" subtitle="Your profile and categories">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 font-display text-2xl">Profile</h2>
        <div className="space-y-1.5">
          <Label htmlFor="name">Display name</Label>
          <Input id="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button className="mt-4" disabled={saveProfile.isPending} onClick={() => saveProfile.mutate()}>
          Save
        </Button>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 font-display text-2xl">Categories</h2>
        <ul className="space-y-2">
          {(categories.data ?? []).map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
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
