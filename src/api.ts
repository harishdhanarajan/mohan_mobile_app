import { supabase } from "./supabase";
import type { NotificationItem, Profile, Project, Task, WorkspaceState } from "./types";

export async function loadWorkspace() {
  const [usersRes, projectsRes, tasksRes, notifsRes] = await Promise.all([
    supabase.from("users").select("*").order("name", { ascending: true }),
    supabase.from("projects").select("*").order("name", { ascending: true }),
    supabase.from("tasks").select("*").order("dueDate", { ascending: true, nullsFirst: false }),
    supabase.from("notifications").select("*").order("ts", { ascending: false }).limit(50)
  ]);

  const error = usersRes.error || projectsRes.error || tasksRes.error || notifsRes.error;
  if (error) throw error;

  return {
    users: (usersRes.data || []) as Profile[],
    projects: (projectsRes.data || []) as Project[],
    tasks: (tasksRes.data || []) as Task[],
    notifications: (notifsRes.data || []) as NotificationItem[]
  } satisfies WorkspaceState;
}

export async function signIn(email: string, password: string) {
  const cleanEmail = email.trim().toLowerCase();
  const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
  if (error) throw error;
}

export async function loadProfileByAuthUser(authUserId: string) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw error;
}
