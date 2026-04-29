import { MaterialIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { supabase } from "./src/supabase";
import { loadProfileByAuthUser, loadWorkspace, signIn, signOut } from "./src/api";
import { COLORS, FONT, RADIUS, SIZES, SHADOW } from "./src/theme";
import { PRIORITY_LABELS, STATUS_LABELS, STATUS_ORDER, dayOffset, formatDue, formatRelTime, id, initials, nowTimestamp, todayISO } from "./src/utils";
import type { Priority, Profile, Project, Status, Task, WorkspaceState } from "./src/types";

type ToastKind = "error" | "success" | "info";
type ToastItem = { id: string; message: string; kind: ToastKind };
type TabId = "dashboard" | "tasks" | "board" | "calendar" | "team";

const ADMIN_TABS: { id: TabId; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { id: "dashboard", label: "Dashboard", icon: "space-dashboard" },
  { id: "tasks", label: "Tasks", icon: "checklist" },
  { id: "board", label: "Board", icon: "view-kanban" },
  { id: "calendar", label: "Calendar", icon: "event" },
  { id: "team", label: "Team", icon: "groups" }
];

const USER_TABS: { id: TabId; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { id: "tasks", label: "Tasks", icon: "checklist" },
  { id: "board", label: "Board", icon: "view-kanban" },
  { id: "calendar", label: "Calendar", icon: "event" }
];

const INITIAL_TASK_FORM = {
  id: "",
  title: "",
  description: "",
  assigneeId: "",
  projectId: "",
  priority: "medium" as Priority,
  status: "todo" as Status,
  startDate: todayISO(),
  dueDate: dayOffset(3),
  tagsText: ""
};

const EMPTY_WORKSPACE: WorkspaceState = { users: [], projects: [], tasks: [], notifications: [] };

function badgeColor(priority: Priority) {
  return priority === "high" ? COLORS.high : priority === "medium" ? COLORS.medium : COLORS.low;
}

function statusColor(status: Status) {
  if (status === "in-progress") return COLORS.progress;
  if (status === "review") return COLORS.review;
  if (status === "done") return COLORS.done;
  return COLORS.todo;
}

function sortTasks(list: Task[]) {
  const rank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
  return [...list].sort((a, b) => {
    if (a.status === "done" && b.status !== "done") return 1;
    if (a.status !== "done" && b.status === "done") return -1;
    if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority];
    return (a.dueDate || "").localeCompare(b.dueDate || "");
  });
}

function useSession() {
  const [ready, setReady] = React.useState(false);
  const [authUserId, setAuthUserId] = React.useState<string | null>(null);
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [workspace, setWorkspace] = React.useState<WorkspaceState>(EMPTY_WORKSPACE);
  const [error, setError] = React.useState<string | null>(null);

  const reloadWorkspace = React.useCallback(async () => {
    const next = await loadWorkspace();
    setWorkspace(next);
  }, []);

  React.useEffect(() => {
    let mounted = true;
    supabase.auth.getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setAuthUserId(data.session?.user.id || null);
        setReady(true);
      })
      .catch(e => {
        if (!mounted) return;
        setError(e?.message || String(e));
        setReady(true);
      });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setAuthUserId(nextSession?.user.id || null);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    if (!authUserId) {
      setProfile(null);
      setWorkspace(EMPTY_WORKSPACE);
      return;
    }
    loadProfileByAuthUser(authUserId)
      .then(p => {
        if (!p) {
          setError("This account has no profile yet. Ask your admin to provision it.");
          supabase.auth.signOut().catch(() => undefined);
          return;
        }
        if (p.role !== "user") {
          setError("Admin accounts must sign in on the desktop app.");
          supabase.auth.signOut().catch(() => undefined);
          return;
        }
        setProfile(p);
      })
      .catch(e => setError(e?.message || String(e)));
  }, [authUserId]);

  React.useEffect(() => {
    if (!profile) return;
    reloadWorkspace().catch(e => setError(e?.message || String(e)));
  }, [profile, reloadWorkspace]);

  return { ready, profile, setProfile, workspace, setWorkspace, reloadWorkspace, error, setError };
}

function AppButton(props: { label: string; onPress?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger"; icon?: keyof typeof MaterialIcons.glyphMap; disabled?: boolean }) {
  const variant = props.variant || "primary";
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      style={({ pressed }) => [
        styles.button,
        styles[`button_${variant}` as const],
        pressed && !props.disabled && styles.buttonPressed,
        props.disabled && styles.buttonDisabled
      ]}
    >
      {props.icon && <MaterialIcons name={props.icon} size={16} color={variant === "ghost" ? COLORS.text : "#fff"} style={{ marginRight: 8 }} />}
      <Text style={[styles.buttonText, variant === "ghost" && { color: COLORS.text }, variant === "danger" && { color: "#fff" }]}>{props.label}</Text>
    </Pressable>
  );
}

function AppChip(props: { label: string; active?: boolean; onPress?: () => void; tone?: "default" | "priority" | "status" }) {
  return (
    <Pressable onPress={props.onPress} style={({ pressed }) => [
      styles.chip,
      props.active && styles.chipActive,
      pressed && styles.buttonPressed
    ]}>
      <Text style={[styles.chipText, props.active && styles.chipTextActive]}>{props.label}</Text>
    </Pressable>
  );
}

function Avatar({ user, size = 38 }: { user?: Profile | null; size?: number }) {
  const title = user ? initials(user.name) : "?";
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: user ? COLORS.accent : COLORS.textSoft }]}>
      <Text style={styles.avatarText}>{title}</Text>
    </View>
  );
}

function SectionCard(props: { title?: string; subtitle?: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[styles.card, props.style]}>
      {(props.title || props.subtitle) && (
        <View style={{ marginBottom: 12 }}>
          {props.title ? <Text style={styles.cardTitle}>{props.title}</Text> : null}
          {props.subtitle ? <Text style={styles.cardSubtitle}>{props.subtitle}</Text> : null}
        </View>
      )}
      {props.children}
    </View>
  );
}

function LoadingScreen({ label = "Loading workspace..." }) {
  return (
    <View style={styles.loadingWrap}>
      <View style={styles.loadingCard}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>M</Text></View>
        <ActivityIndicator color={COLORS.accent} />
        <Text style={styles.loadingText}>{label}</Text>
      </View>
    </View>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <View style={styles.loadingWrap}>
      <SectionCard title="Something failed" subtitle={message}>
        <Text style={styles.bodyMuted}>Check the Supabase URL, anon key, and network connection.</Text>
      </SectionCard>
    </View>
  );
}

function AuthScreen(props: { onToast: (message: string, kind?: ToastKind) => void }) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password.trim()) {
      props.onToast("Email and password are required.");
      return;
    }
    setBusy(true);
    try {
      await signIn(cleanEmail, password);
    } catch (e: any) {
      props.onToast(e?.message || "Sign in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
      <View style={styles.authShell}>
        <View style={styles.authPanel}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>M</Text></View>
            <View>
              <Text style={styles.brandName}>MYT</Text>
              <Text style={styles.brandSub}>My Task List</Text>
            </View>
          </View>

          <Text style={styles.authTitle}>Sign in to MYT</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email address" keyboardType="email-address" autoCapitalize="none" placeholderTextColor={COLORS.textMuted} />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry placeholderTextColor={COLORS.textMuted} />
          </View>

          <AppButton label={busy ? "Signing in..." : "Sign in"} onPress={submit} disabled={busy} />
        </View>
      </View>
    </ScrollView>
  );
}

function TaskRow(props: { task: Task; users: Profile[]; projects: Project[]; onOpen: (task: Task) => void; onToggleDone?: (task: Task) => void }) {
  const assignee = props.users.find(u => u.id === props.task.assigneeId);
  const project = props.projects.find(p => p.id === props.task.projectId);
  const isDone = props.task.status === "done";
  return (
    <Pressable onPress={() => props.onOpen(props.task)} style={({ pressed }) => [styles.taskRow, pressed && styles.buttonPressed]}>
      <View style={[styles.prioBar, { backgroundColor: badgeColor(props.task.priority) }]} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.taskTitle, isDone && styles.strike]} numberOfLines={1}>{props.task.title}</Text>
        <Text style={styles.taskMeta} numberOfLines={1}>
          {project ? project.name : "No project"}  {" · "} {assignee ? assignee.name : "Unassigned"}  {" · "} {formatDue(props.task.dueDate)}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 8 }}>
        <View style={[styles.badge, { backgroundColor: `${statusColor(props.task.status)}18` }]}>
          <Text style={[styles.badgeText, { color: statusColor(props.task.status) }]}>{STATUS_LABELS[props.task.status]}</Text>
        </View>
        {props.onToggleDone && (
          <Pressable onPress={() => props.onToggleDone?.(props.task)} hitSlop={12} style={styles.checkbox}>
            <MaterialIcons name={isDone ? "check-box" : "check-box-outline-blank"} size={20} color={isDone ? COLORS.done : COLORS.textMuted} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

function ProjectGroupedTasks(props: { tasks: Task[]; users: Profile[]; projects: Project[]; onOpen: (task: Task) => void; onToggleDone?: (task: Task) => void }) {
  const sections = React.useMemo(() => {
    const groups = new Map<string, { project: Project | null; tasks: Task[] }>();

    props.tasks.forEach(task => {
      const project = props.projects.find(item => item.id === task.projectId) || null;
      const key = project?.id || "__no_project__";
      const current = groups.get(key) || { project, tasks: [] };
      current.tasks.push(task);
      groups.set(key, current);
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (!a.project && b.project) return 1;
      if (a.project && !b.project) return -1;
      return (a.project?.name || "No project").localeCompare(b.project?.name || "No project");
    });
  }, [props.projects, props.tasks]);

  if (!sections.length) return <Text style={styles.bodyMuted}>No tasks match.</Text>;

  return (
    <View style={styles.projectTaskList}>
      {sections.map(section => (
        <View key={section.project?.id || "no-project"} style={styles.projectTaskSection}>
          <View style={styles.projectTaskHead}>
            <View style={[styles.projectSwatch, { backgroundColor: section.project?.color || COLORS.textMuted }]} />
            <Text style={styles.projectTaskTitle}>{section.project?.name || "No project"}</Text>
            <Text style={styles.projectTaskCount}>{section.tasks.length}</Text>
          </View>
          <View style={{ gap: 10 }}>
            {section.tasks.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                users={props.users}
                projects={props.projects}
                onOpen={props.onOpen}
                onToggleDone={props.onToggleDone}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function TaskModal(props: {
  visible: boolean;
  task: Task | null;
  workspace: WorkspaceState;
  currentUser: Profile;
  onClose: () => void;
  onSave: (task: Task) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  onToast: (message: string, kind?: ToastKind) => void;
  onMoveStatus: (taskId: string, status: Status) => Promise<void>;
}) {
  const isNew = !props.task;
  const [tab, setTab] = React.useState<"comments" | "activity">("comments");
  const [busy, setBusy] = React.useState(false);
  const [comment, setComment] = React.useState("");
  const [editing, setEditing] = React.useState(isNew);
  const [editingCommentId, setEditingCommentId] = React.useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = React.useState("");
  const [form, setForm] = React.useState({ ...INITIAL_TASK_FORM });

  const startEditComment = (commentId: string, currentText: string) => {
    setEditingCommentId(commentId);
    setEditingCommentText(currentText);
  };
  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentText("");
  };
  const saveEditComment = async () => {
    if (!props.task || !editingCommentId) return;
    const trimmed = editingCommentText.trim();
    if (!trimmed) return;
    const updated: Task = {
      ...props.task,
      comments: props.task.comments.map(c =>
        c.id === editingCommentId ? { ...c, text: trimmed } : c
      ),
      activity: [...props.task.activity, {
        ts: nowTimestamp(),
        actor: props.currentUser.id,
        text: "edited a comment"
      }]
    };
    setBusy(true);
    try {
      await props.onSave(updated);
      cancelEditComment();
    } finally {
      setBusy(false);
    }
  };

  React.useEffect(() => {
    if (!props.task) {
      setForm({
        ...INITIAL_TASK_FORM,
        assigneeId: props.workspace.users.find(u => u.role === "user")?.id || props.currentUser.id,
        projectId: props.workspace.projects[0]?.id || "",
        id: id("t")
      });
      setEditing(true);
      return;
    }
    setForm({
      id: props.task.id,
      title: props.task.title,
      description: props.task.description,
      assigneeId: props.task.assigneeId || props.currentUser.id,
      projectId: props.task.projectId || "",
      priority: props.task.priority,
      status: props.task.status,
      startDate: props.task.startDate || todayISO(),
      dueDate: props.task.dueDate || dayOffset(3),
      tagsText: props.task.tags.join(", ")
    });
    setEditing(false);
  }, [props.task, props.currentUser.id, props.workspace.projects, props.workspace.users]);

  const save = async () => {
    if (!form.title.trim()) {
      props.onToast("Task title is required.");
      return;
    }
    if (form.status === "done" && !(props.task?.comments || []).length) {
      props.onToast("Add at least one comment before closing this task as done.");
      return;
    }
    const admin = props.workspace.users.find(u => u.role === "admin");
    if (form.status === "review" && !admin) {
      props.onToast("No admin user is available to receive review tasks.");
      return;
    }
    const baseTask: Task = {
      id: form.id || id("t"),
      title: form.title.trim(),
      description: form.description.trim(),
      assigneeId: form.status === "review" ? admin!.id : form.assigneeId,
      projectId: form.projectId || null,
      priority: form.priority,
      status: form.status,
      startDate: form.startDate || null,
      dueDate: form.dueDate || null,
      tags: form.tagsText.split(",").map(s => s.trim()).filter(Boolean),
      attachments: props.task?.attachments || [],
      comments: props.task?.comments || [],
      activity: [...(props.task?.activity || []), { ts: nowTimestamp(), actor: props.currentUser.id, text: isNew ? "created task" : "edited task details" }]
    };
    setBusy(true);
    try {
      await props.onSave(baseTask);
      props.onClose();
    } finally {
      setBusy(false);
    }
  };

  const addComment = async () => {
    const text = comment.trim();
    if (!text || !props.task) return;
    const updated: Task = {
      ...props.task,
      comments: [...props.task.comments, { id: id("c"), authorId: props.currentUser.id, ts: nowTimestamp(), text }],
      activity: [...props.task.activity, { ts: nowTimestamp(), actor: props.currentUser.id, text: "added a comment" }]
    };
    setBusy(true);
    try {
      await props.onSave(updated);
      setComment("");
    } finally {
      setBusy(false);
    }
  };

  const deleteTask = async () => {
    if (!props.task) return;
    setBusy(true);
    try {
      await props.onDelete(props.task.id);
      props.onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={() => undefined}>
      <View style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetKicker}>{props.task ? `TASK ${props.task.id.toUpperCase()}` : "NEW TASK"}</Text>
              <Text style={styles.sheetTitle}>{props.task ? props.task.title : "Create task"}</Text>
            </View>
            <Pressable onPress={props.onClose} style={styles.iconButton}>
              <MaterialIcons name="close" size={18} color={COLORS.text} />
            </Pressable>
          </View>

          {editing ? (
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
              <Field label="Title">
                <TextInput style={styles.input} value={form.title} onChangeText={v => setForm(f => ({ ...f, title: v }))} placeholder="What needs to be done?" placeholderTextColor={COLORS.textMuted} />
              </Field>
              <Field label="Description">
                <TextInput style={[styles.input, styles.textArea]} value={form.description} onChangeText={v => setForm(f => ({ ...f, description: v }))} placeholder="Add context, requirements, links..." multiline placeholderTextColor={COLORS.textMuted} />
              </Field>
              <Row2>
                <Field label="Assignee">
                  <PickerInput
                    value={form.assigneeId}
                    options={props.workspace.users.filter(u => u.role === "user").map(u => ({ label: u.name, value: u.id }))}
                    onChange={v => setForm(f => ({ ...f, assigneeId: v }))}
                  />
                </Field>
                <Field label="Project">
                  <PickerInput
                    value={form.projectId}
                    options={[{ label: "No project", value: "" }, ...props.workspace.projects.map(p => ({ label: p.name, value: p.id }))]}
                    onChange={v => setForm(f => ({ ...f, projectId: v }))}
                  />
                </Field>
              </Row2>
              <Row2>
                <Field label="Priority">
                  <PickerInput value={form.priority} options={["low", "medium", "high"].map(v => ({ label: PRIORITY_LABELS[v as Priority], value: v }))} onChange={v => setForm(f => ({ ...f, priority: v as Priority }))} />
                </Field>
                <Field label="Status">
                  <DropdownInput value={form.status} options={STATUS_ORDER.map(v => ({ label: STATUS_LABELS[v], value: v }))} onChange={v => setForm(f => ({ ...f, status: v as Status, assigneeId: v === "review" ? props.workspace.users.find(u => u.role === "admin")?.id || f.assigneeId : f.assigneeId }))} />
                </Field>
              </Row2>
              <Row2>
                <Field label="Start date">
                  <TextInput style={styles.input} value={form.startDate} onChangeText={v => setForm(f => ({ ...f, startDate: v }))} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textMuted} />
                </Field>
                <Field label="Due date">
                  <TextInput style={styles.input} value={form.dueDate} onChangeText={v => setForm(f => ({ ...f, dueDate: v }))} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textMuted} />
                </Field>
              </Row2>
              <Field label="Tags">
                <TextInput style={styles.input} value={form.tagsText} onChangeText={v => setForm(f => ({ ...f, tagsText: v }))} placeholder="Tags separated by commas" placeholderTextColor={COLORS.textMuted} />
              </Field>
              <View style={styles.sheetFoot}>
                <AppButton label={busy ? "Saving..." : props.task ? "Save changes" : "Create task"} onPress={save} disabled={busy} />
              </View>
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={styles.metaGrid}>
                <Meta label="Status" value={STATUS_LABELS[props.task!.status]} color={statusColor(props.task!.status)} />
                <Meta label="Priority" value={PRIORITY_LABELS[props.task!.priority]} color={badgeColor(props.task!.priority)} />
                <Meta label="Due" value={formatDue(props.task!.dueDate)} color={COLORS.text} />
                <Meta label="Comments" value={`${props.task!.comments.length}`} color={COLORS.text} />
              </View>
              <Text style={styles.fieldLabel}>Description</Text>
              <Text style={styles.body}>{props.task?.description || "No description."}</Text>
              {props.currentUser.role === "admin" && (
                <View style={{ marginTop: 16, flexDirection: "row", gap: 8 }}>
                  <AppButton label="Edit task" variant="secondary" onPress={() => setEditing(true)} />
                  <AppButton label="Delete" variant="danger" onPress={deleteTask} />
                </View>
              )}

              <View style={styles.tabRow}>
                <AppChip label="Comments" active={tab === "comments"} onPress={() => setTab("comments")} />
                <AppChip label="Activity" active={tab === "activity"} onPress={() => setTab("activity")} />
              </View>

              {tab === "comments" ? (
                <View style={{ gap: 10 }}>
                  {(props.task?.comments.length || 0) === 0 ? (
                    <Text style={styles.bodyMuted}>No comments yet.</Text>
                  ) : props.task?.comments.map(c => {
                    const author = props.workspace.users.find(u => u.id === c.authorId);
                    const isMine = c.authorId === props.currentUser.id;
                    const isEditing = editingCommentId === c.id;
                    return (
                      <View key={c.id} style={styles.commentRow}>
                        <Avatar user={author} size={30} />
                        <View style={{ flex: 1 }}>
                          {isEditing ? (
                            <View style={{ gap: 8 }}>
                              <TextInput
                                style={[styles.input, styles.textArea]}
                                value={editingCommentText}
                                onChangeText={setEditingCommentText}
                                multiline
                                autoFocus
                                placeholderTextColor={COLORS.textMuted}
                              />
                              <View style={{ flexDirection: "row", gap: 8 }}>
                                <AppButton label={busy ? "Saving..." : "Save"} onPress={saveEditComment} disabled={busy || !editingCommentText.trim()} />
                                <AppButton label="Cancel" variant="ghost" onPress={cancelEditComment} disabled={busy} />
                              </View>
                            </View>
                          ) : (
                            <>
                              <View style={styles.commentBubble}>
                                <Text style={styles.body}>{c.text}</Text>
                              </View>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 }}>
                                <Text style={[styles.commentMeta, { marginTop: 0 }]}>{author?.name || "Someone"} · {formatRelTime(c.ts)}</Text>
                                {isMine && (
                                  <Pressable onPress={() => startEditComment(c.id, c.text)} hitSlop={8}>
                                    <Text style={[styles.commentMeta, { marginTop: 0, color: COLORS.accent, fontWeight: "700" }]}>Edit</Text>
                                  </Pressable>
                                )}
                              </View>
                            </>
                          )}
                        </View>
                      </View>
                    );
                  })}
                  <View style={styles.commentComposer}>
                    <TextInput style={[styles.input, styles.textArea]} value={comment} onChangeText={setComment} placeholder="Write a comment..." multiline placeholderTextColor={COLORS.textMuted} />
                    <AppButton label="Post comment" onPress={addComment} disabled={busy || !comment.trim()} />
                  </View>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {props.task?.activity.slice().reverse().map((a, index) => {
                    const actor = props.workspace.users.find(u => u.id === a.actor);
                    return (
                      <View key={`${a.ts}-${index}`} style={styles.activityRow}>
                        <View style={styles.activityDot} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.body}><Text style={{ fontWeight: "700" }}>{actor?.name || "Someone"}</Text> {a.text}</Text>
                          <Text style={styles.commentMeta}>{formatRelTime(a.ts)}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          )}

          {!editing && props.task && props.task.status !== "done" && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.fieldLabel}>Move task to</Text>
              <DropdownInput
                value={props.task.status}
                options={STATUS_ORDER.map(s => ({ label: STATUS_LABELS[s], value: s }))}
                onChange={v => {
                  if (v && v !== props.task!.status) {
                    props.onMoveStatus(props.task!.id, v as Status);
                  }
                }}
              />
            </View>
          )}

          <View style={styles.sheetFoot}>
            <View style={{ flex: 1 }} />
            <AppButton label="Close" variant="ghost" onPress={props.onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Row2({ children }: { children: React.ReactNode }) {
  return <View style={styles.row2}>{children}</View>;
}

function Meta({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.metaBox}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[styles.metaValue, { color }]}>{value}</Text>
    </View>
  );
}

function PickerInput(props: { value: string; options: { label: string; value: string }[]; onChange: (value: string) => void }) {
  return (
    <View style={styles.pickerWrap}>
      <FlatList
        horizontal
        data={props.options}
        keyExtractor={item => item.value + item.label}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable onPress={() => props.onChange(item.value)} style={({ pressed }) => [
            styles.pickerItem,
            props.value === item.value && styles.pickerItemActive,
            pressed && styles.buttonPressed
          ]}>
            <Text style={[styles.pickerText, props.value === item.value && styles.pickerTextActive]}>{item.label}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

function DropdownInput(props: { value: string; options: { label: string; value: string }[]; onChange: (value: string) => void; placeholder?: string }) {
  const [open, setOpen] = React.useState(false);
  const selected = props.options.find(item => item.value === props.value);

  return (
    <View style={styles.dropdownWrap}>
      <Pressable onPress={() => setOpen(true)} style={({ pressed }) => [styles.dropdownButton, pressed && styles.buttonPressed]}>
        <Text style={[styles.dropdownText, !selected && styles.dropdownPlaceholder]} numberOfLines={1}>
          {selected?.label || props.placeholder || "Choose status"}
        </Text>
        <MaterialIcons name={open ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={20} color={COLORS.textMuted} />
      </Pressable>
      {open && (
        <View style={styles.dropdownMenu}>
          {props.options.map(item => {
            const active = item.value === props.value;
            return (
              <Pressable
                key={`${item.value}-${item.label}`}
                onPress={() => {
                  props.onChange(item.value);
                  setOpen(false);
                }}
                style={({ pressed }) => [styles.dropdownOption, active && styles.dropdownOptionActive, pressed && styles.buttonPressed]}
              >
                <Text style={[styles.dropdownOptionText, active && styles.dropdownOptionTextActive]}>{item.label}</Text>
                {active && <MaterialIcons name="check" size={18} color={COLORS.accent} />}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calendarSectionLabel(dateStr: string | null) {
  if (!dateStr) return "No due date";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return target.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function CalendarListView(props: { tasks: Task[]; users: Profile[]; projects: Project[]; onOpen: (task: Task) => void }) {
  const sections = React.useMemo(() => {
    const dated = props.tasks
      .filter(task => task.dueDate)
      .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
    const undated = props.tasks.filter(task => !task.dueDate);
    const groups = new Map<string | null, Task[]>();

    dated.forEach(task => {
      const key = task.dueDate || null;
      groups.set(key, [...(groups.get(key) || []), task]);
    });
    if (undated.length) groups.set(null, undated);

    return Array.from(groups.entries()).map(([dateStr, tasks]) => ({ dateStr, tasks }));
  }, [props.tasks]);

  return (
    <SectionCard title="Calendar" subtitle="Tasks grouped by due date">
      <View style={styles.calendarList}>
        {sections.length === 0 ? (
          <Text style={styles.bodyMuted}>No tasks match.</Text>
        ) : sections.map(section => (
          <View key={section.dateStr || "no-date"} style={styles.calendarSection}>
            <View style={styles.calendarSectionHead}>
              <Text style={styles.calendarSectionTitle}>{calendarSectionLabel(section.dateStr)}</Text>
              <Text style={styles.calendarSectionCount}>{section.tasks.length}</Text>
            </View>
            <View style={{ gap: 10 }}>
              {section.tasks.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  users={props.users}
                  projects={props.projects}
                  onOpen={props.onOpen}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
    </SectionCard>
  );
}

function Toasts({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: string) => void }) {
  if (!items.length) return null;
  return (
    <View style={styles.toastStack} pointerEvents="box-none">
      {items.map(item => (
        <Pressable key={item.id} onPress={() => onDismiss(item.id)} style={[styles.toast, item.kind === "success" && styles.toastSuccess, item.kind === "info" && styles.toastInfo]}>
          <Text style={styles.toastText}>{item.message}</Text>
          <MaterialIcons name="close" size={16} color={COLORS.text} />
        </Pressable>
      ))}
    </View>
  );
}

function ConfirmDialog(props: { visible: boolean; title: string; message: string; confirmLabel: string; kind?: "danger" | "primary"; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={() => undefined}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.sheet, { maxHeight: 280 }]}>
          <View style={styles.sheetHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetKicker}>CONFIRM</Text>
              <Text style={styles.sheetTitle}>{props.title}</Text>
            </View>
            <Pressable onPress={props.onCancel} style={styles.iconButton}>
              <MaterialIcons name="close" size={18} color={COLORS.text} />
            </Pressable>
          </View>
          <Text style={styles.body}>{props.message}</Text>
          <View style={styles.sheetFoot}>
            <AppButton label="Cancel" variant="ghost" onPress={props.onCancel} />
            <AppButton label={props.confirmLabel} variant={props.kind === "danger" ? "danger" : "primary"} onPress={props.onConfirm} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function App() {
  const { ready, profile, workspace, setWorkspace, reloadWorkspace, error, setError } = useSession();
  const [tab, setTab] = React.useState<TabId>("tasks");
  const [taskFilter, setTaskFilter] = React.useState<{ priority: Priority | null; status: Status | null }>({ priority: null, status: null });
  const [search, setSearch] = React.useState("");
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);
  const [taskModalVisible, setTaskModalVisible] = React.useState(false);
  const [confirm, setConfirm] = React.useState<{ title: string; message: string; confirmLabel: string; kind?: "danger" | "primary"; onConfirm: () => void } | null>(null);
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const [creatingUser, setCreatingUser] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const toast = React.useCallback((message: string, kind: ToastKind = "error") => {
    const item = { id: id("toast"), message, kind };
    setToasts(items => [...items.slice(-2), item]);
    setTimeout(() => setToasts(items => items.filter(t => t.id !== item.id)), 4000);
  }, []);

  const refresh = React.useCallback(async () => {
    try {
      await reloadWorkspace();
    } catch (e: any) {
      toast(e?.message || "Unable to reload workspace.");
    }
  }, [reloadWorkspace, toast]);

  const currentUser = profile;
  const isAdmin = currentUser?.role === "admin";

  const visibleTasks = sortTasks(
    workspace.tasks.filter(task => {
      const scoped = isAdmin ? true : task.assigneeId === currentUser?.id;
      const p = !taskFilter.priority || task.priority === taskFilter.priority;
      const s = !taskFilter.status || task.status === taskFilter.status;
      const q = !search.trim() || [task.title, task.description, ...(task.tags || []), workspace.users.find(u => u.id === task.assigneeId)?.name || ""].join(" ").toLowerCase().includes(search.toLowerCase());
      return scoped && p && s && q;
    })
  );

  const saveTask = async (task: Task) => {
    if (!currentUser) return;
    const existing = workspace.tasks.find(t => t.id === task.id);
    if (task.status === "done" && !(task.comments || []).length) {
      toast("Add at least one comment before closing this task as done.");
      return;
    }
    const admin = workspace.users.find(u => u.role === "admin");
    if (task.status === "review" && !admin) {
      toast("No admin user is available to receive review tasks.");
      return;
    }
    const nextTask: Task = {
      ...task,
      assigneeId: task.status === "review" ? admin!.id : task.assigneeId,
      activity: task.activity.length ? task.activity : [{ ts: nowTimestamp(), actor: currentUser.id, text: existing ? "edited task details" : "created task" }]
    };
    try {
      if (existing) {
        const { error } = await supabase.from("tasks").update(nextTask).eq("id", nextTask.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tasks").insert(nextTask);
        if (error) throw error;
      }
      await refresh();
    } catch (e: any) {
      toast(e?.message || "Unable to save task.");
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
      await refresh();
    } catch (e: any) {
      toast(e?.message || "Unable to delete task.");
    }
  };

  const moveTask = async (taskId: string, status: Status) => {
    const task = workspace.tasks.find(t => t.id === taskId);
    if (!task || task.status === "done") return;
    if (status === "done" && !(task.comments || []).length) {
      toast("Add at least one comment before closing this task as done.");
      return;
    }
    const admin = workspace.users.find(u => u.role === "admin");
    if (status === "review" && !admin) {
      toast("No admin user is available to receive review tasks.");
      return;
    }
    const patch: Partial<Task> = { status };
    if (status === "review") patch.assigneeId = admin!.id;
    try {
      const { error } = await supabase.from("tasks").update({ ...task, ...patch }).eq("id", taskId);
      if (error) throw error;
      await refresh();
    } catch (e: any) {
      toast(e?.message || "Unable to move task.");
    }
  };

  const toggleDone = async (task: Task) => {
    if (task.status === "done") {
      toast("Done tasks stay closed.");
      return;
    }
    await moveTask(task.id, "done");
  };

  const createUser = async () => {
    try {
      setBusy(true);
      const name = "New user";
      const email = `user-${Date.now()}@example.com`;
      const password = `Temp-${Date.now()}!`;
      const { error } = await supabase.functions.invoke("create-user", {
        body: { name, email, password, role: "user", title: "Team member" }
      });
      if (error) throw error;
      toast("Invite request sent.", "success");
      await refresh();
    } catch (e: any) {
      toast(e?.message || "Create-user function is not deployed yet.");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    try {
      await signOut();
    } catch (e: any) {
      toast(e?.message || "Unable to sign out.");
    }
  };

  if (error) return <ErrorScreen message={error} />;
  if (!ready) return <LoadingScreen label="Loading workspace..." />;
  if (!currentUser) return <AuthScreen onToast={toast} />;

  const tabs = isAdmin ? ADMIN_TABS : USER_TABS;
  const title = tab === "dashboard" ? "Dashboard" : tab === "tasks" ? (isAdmin ? "All tasks" : "My tasks") : tab === "board" ? "Board" : tab === "calendar" ? "Calendar" : "Team members";
  const subtitle = tab === "dashboard"
    ? "Workload overview, priorities, and activity"
    : tab === "tasks"
      ? `${visibleTasks.length} tasks`
      : tab === "board"
        ? "Drag-style board"
        : tab === "calendar"
          ? "Tasks by due date"
          : tab === "team"
            ? "Manage members and access"
            : "Create, edit, and remove workstreams";

  const openTask = (task: Task) => {
    setSelectedTask(task);
    setTaskModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.screen}>
        <View style={styles.topbar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.topTitle}>{title}</Text>
            <Text style={styles.topSub}>{subtitle}</Text>
          </View>
          <Pressable onPress={logout} style={styles.iconButton}>
            <MaterialIcons name="logout" size={18} color={COLORS.text} />
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={18} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search across workspace..."
              placeholderTextColor={COLORS.textMuted}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          {isAdmin && <AppButton label="New task" icon="add" onPress={() => { setSelectedTask(null); setTaskModalVisible(true); }} />}
        </View>

        <View style={styles.filterWrap}>
          <FlatList
            horizontal
            data={[{ label: "All priorities", value: "" }, ...(["high", "medium", "low"] as Priority[]).map(p => ({ label: PRIORITY_LABELS[p], value: p }))]}
            keyExtractor={item => `p-${item.value || "all"}`}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <AppChip label={item.label} active={(taskFilter.priority || "") === item.value} onPress={() => setTaskFilter(f => ({ ...f, priority: item.value ? item.value as Priority : null }))} />
            )}
            ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
          />
          <FlatList
            horizontal
            data={[{ label: "All statuses", value: "" }, ...STATUS_ORDER.map(s => ({ label: STATUS_LABELS[s], value: s }))]}
            keyExtractor={item => `s-${item.value || "all"}`}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <AppChip label={item.label} active={(taskFilter.status || "") === item.value} onPress={() => setTaskFilter(f => ({ ...f, status: item.value ? item.value as Status : null }))} />
            )}
            ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
          />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {tab === "dashboard" && isAdmin && (
            <>
              <View style={styles.kpiRow}>
                <SectionCard style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Open tasks</Text>
                  <Text style={styles.kpiValue}>{workspace.tasks.filter(t => t.status !== "done").length}</Text>
                </SectionCard>
                <SectionCard style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>In review</Text>
                  <Text style={styles.kpiValue}>{workspace.tasks.filter(t => t.status === "review").length}</Text>
                </SectionCard>
              </View>
              <SectionCard title="Tasks by status" subtitle="Distribution across all tasks">
                <View style={styles.statusRail}>
                  {STATUS_ORDER.map(s => (
                    <View key={s} style={styles.statusRow}>
                      <Text style={styles.statusLabel}>{STATUS_LABELS[s]}</Text>
                      <View style={styles.statusBarTrack}>
                        <View style={[styles.statusBarFill, { backgroundColor: statusColor(s), width: `${Math.max(8, (workspace.tasks.filter(t => t.status === s).length / Math.max(workspace.tasks.length, 1)) * 100)}%` }]} />
                      </View>
                      <Text style={styles.statusCount}>{workspace.tasks.filter(t => t.status === s).length}</Text>
                    </View>
                  ))}
                </View>
              </SectionCard>
            </>
          )}

          {tab === "tasks" && (
            <SectionCard title={isAdmin ? "All tasks" : "My tasks"} subtitle="Grouped by project">
              <ProjectGroupedTasks tasks={visibleTasks} users={workspace.users} projects={workspace.projects} onOpen={openTask} onToggleDone={isAdmin ? toggleDone : undefined} />
            </SectionCard>
          )}

          {tab === "board" && (
            <View style={styles.boardWrap}>
              {STATUS_ORDER.map(status => {
                const colTasks = visibleTasks.filter(t => t.status === status);
                return (
                  <SectionCard key={status} title={STATUS_LABELS[status]} subtitle={`${colTasks.length} tasks`} style={styles.boardColumn}>
                    <View style={{ gap: 10 }}>
                      {colTasks.length === 0 ? <Text style={styles.bodyMuted}>Nothing here.</Text> : colTasks.map(task => <TaskRow key={task.id} task={task} users={workspace.users} projects={workspace.projects} onOpen={openTask} onToggleDone={isAdmin ? toggleDone : undefined} />)}
                    </View>
                  </SectionCard>
                );
              })}
            </View>
          )}

          {tab === "calendar" && (
            <CalendarListView tasks={visibleTasks} users={workspace.users} projects={workspace.projects} onOpen={openTask} />
          )}

          {tab === "team" && isAdmin && (
            <SectionCard title="Team members" subtitle="Manage access and assignments">
              <View style={{ gap: 12 }}>
                <AppButton label={busy ? "Working..." : "Invite user"} icon="person-add" onPress={createUser} disabled={busy} />
                {workspace.users.map(user => (
                  <View key={user.id} style={styles.personRow}>
                    <Avatar user={user} size={34} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.personName}>{user.name}</Text>
                      <Text style={styles.personMeta}>{user.email}</Text>
                    </View>
                    <View style={styles.badge}><Text style={styles.badgeText}>{user.role === "admin" ? "Admin" : user.title || "User"}</Text></View>
                  </View>
                ))}
              </View>
            </SectionCard>
          )}

        </ScrollView>

        <View style={styles.tabBar}>
          {tabs.map(item => (
            <Pressable key={item.id} onPress={() => setTab(item.id)} style={styles.tabItem}>
              <MaterialIcons name={item.icon} size={20} color={tab === item.id ? COLORS.accent : COLORS.textMuted} />
              <Text style={[styles.tabText, tab === item.id && styles.tabTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <TaskModal
        visible={taskModalVisible}
        task={selectedTask}
        workspace={workspace}
        currentUser={currentUser}
        onClose={() => setTaskModalVisible(false)}
        onSave={saveTask}
        onDelete={deleteTask}
        onToast={toast}
        onMoveStatus={moveTask}
      />

      <ConfirmDialog
        visible={!!confirm}
        title={confirm?.title || ""}
        message={confirm?.message || ""}
        confirmLabel={confirm?.confirmLabel || "Confirm"}
        kind={confirm?.kind}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          confirm?.onConfirm();
          setConfirm(null);
        }}
      />

      <Toasts items={toasts} onDismiss={id => setToasts(items => items.filter(t => t.id !== id))} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg, paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight : 0 },
  screen: { flex: 1, backgroundColor: COLORS.bg },
  loadingWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  loadingCard: { alignItems: "center", gap: 16, backgroundColor: COLORS.surface, padding: 24, borderRadius: 24, width: "100%", maxWidth: 340, ...SHADOW },
  loadingText: { fontFamily: FONT, color: COLORS.textSoft, fontSize: 14 },
  brandMark: { width: 40, height: 40, borderRadius: 10, backgroundColor: COLORS.accent, alignItems: "center", justifyContent: "center" },
  brandMarkText: { color: "#fff", fontWeight: "800" },
  brandName: { color: COLORS.text, fontSize: 16, fontWeight: "700" },
  brandSub: { color: COLORS.textMuted, fontSize: 12 },
  authScroll: { flexGrow: 1, backgroundColor: COLORS.bg, justifyContent: "center", padding: 20 },
  authShell: { width: "100%", maxWidth: 420, alignSelf: "center" },
  authPanel: { backgroundColor: COLORS.surface, borderRadius: 24, padding: 20, ...SHADOW },
  authArt: { backgroundColor: COLORS.surface, borderRadius: 24, padding: 20, ...SHADOW, minHeight: 180, justifyContent: "flex-end" },
  authArtCard: { backgroundColor: COLORS.accentSoft, borderRadius: 20, padding: 18 },
  authArtLabel: { color: COLORS.accent, fontSize: 12, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 },
  authArtHeadline: { color: COLORS.text, fontSize: 24, fontWeight: "800", lineHeight: 32, marginBottom: 8 },
  authArtText: { color: COLORS.textSoft, fontSize: 14, lineHeight: 22 },
  authTitle: { fontSize: 26, fontWeight: "800", color: COLORS.text, lineHeight: 32 },
  authSub: { marginTop: 10, marginBottom: 16, color: COLORS.textSoft, fontSize: 14, lineHeight: 22 },
  topbar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, backgroundColor: COLORS.surface, ...SHADOW },
  topTitle: { fontSize: 20, fontWeight: "800", color: COLORS.text },
  topSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  searchRow: { flexDirection: "row", gap: 10, alignItems: "center", padding: 16, backgroundColor: COLORS.bg },
  searchBox: { flex: 1, minHeight: 48, borderRadius: 16, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 14, paddingVertical: 0 },
  filterWrap: { gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  content: { padding: 16, paddingBottom: 120, gap: 14 },
  card: { backgroundColor: COLORS.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: COLORS.border, ...SHADOW },
  cardTitle: { color: COLORS.text, fontSize: 16, fontWeight: "800" },
  cardSubtitle: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },
  body: { color: COLORS.textSoft, fontSize: 14, lineHeight: 21 },
  bodyMuted: { color: COLORS.textMuted, fontSize: 13, lineHeight: 20 },
  field: { marginBottom: 12 },
  fieldLabel: { color: COLORS.text, fontWeight: "700", fontSize: 12, marginBottom: 6 },
  input: { minHeight: 48, borderRadius: 14, backgroundColor: COLORS.surfaceSoft, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, color: COLORS.text },
  textArea: { minHeight: 100, paddingTop: 12, textAlignVertical: "top" },
  pickerWrap: { marginTop: 2 },
  pickerItem: { minHeight: 34, paddingHorizontal: 12, borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center", marginRight: 8 },
  pickerItemActive: { backgroundColor: COLORS.accentSoft, borderColor: COLORS.accent },
  pickerText: { color: COLORS.textSoft, fontSize: 12, fontWeight: "700" },
  pickerTextActive: { color: COLORS.accent },
  dropdownWrap: { gap: 6 },
  dropdownButton: { minHeight: 48, borderRadius: 14, backgroundColor: COLORS.surfaceSoft, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  dropdownText: { flex: 1, color: COLORS.text, fontSize: 14, fontWeight: "700" },
  dropdownPlaceholder: { color: COLORS.textMuted },
  dropdownMenu: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 6, borderWidth: 1, borderColor: COLORS.border, ...SHADOW },
  dropdownOption: { minHeight: 48, borderRadius: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  dropdownOptionActive: { backgroundColor: COLORS.accentSoft },
  dropdownOptionText: { color: COLORS.textSoft, fontSize: 14, fontWeight: "700" },
  dropdownOptionTextActive: { color: COLORS.accent },
  button: { minHeight: 48, borderRadius: 14, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  button_primary: { backgroundColor: COLORS.accent },
  button_secondary: { backgroundColor: COLORS.accentSoft },
  button_ghost: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  button_danger: { backgroundColor: COLORS.danger },
  buttonPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  chip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: COLORS.accentSoft, borderColor: COLORS.accent },
  chipText: { color: COLORS.textSoft, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: COLORS.accent },
  avatar: { alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "800" },
  kpiRow: { flexDirection: "row", gap: 12 },
  kpiCard: { flex: 1 },
  kpiLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
  kpiValue: { color: COLORS.text, fontSize: 28, fontWeight: "900", marginTop: 8 },
  taskRow: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 10, paddingHorizontal: 10, borderRadius: 16, backgroundColor: COLORS.surfaceSoft, borderWidth: 1, borderColor: COLORS.border },
  prioBar: { width: 4, alignSelf: "stretch", borderRadius: 999 },
  taskTitle: { color: COLORS.text, fontSize: 14, fontWeight: "800" },
  strike: { textDecorationLine: "line-through", color: COLORS.textMuted },
  taskMeta: { color: COLORS.textMuted, fontSize: 12 },
  checkbox: { padding: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: "800" },
  statusRail: { gap: 10 },
  statusRow: { gap: 6 },
  statusLabel: { color: COLORS.text, fontSize: 12, fontWeight: "700" },
  statusBarTrack: { height: 8, backgroundColor: COLORS.border, borderRadius: 999, overflow: "hidden" },
  statusBarFill: { height: "100%", borderRadius: 999 },
  statusCount: { color: COLORS.textMuted, fontSize: 12, fontWeight: "700" },
  boardWrap: { gap: 12 },
  boardColumn: { minHeight: 140 },
  calendarList: { gap: 16 },
  calendarSection: { gap: 10 },
  calendarSectionHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  calendarSectionTitle: { flex: 1, color: COLORS.text, fontSize: 14, fontWeight: "900" },
  calendarSectionCount: { minWidth: 28, textAlign: "center", color: COLORS.accent, backgroundColor: COLORS.accentSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, fontSize: 12, fontWeight: "900" },
  personRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, backgroundColor: COLORS.surfaceSoft, borderWidth: 1, borderColor: COLORS.border },
  personName: { color: COLORS.text, fontSize: 14, fontWeight: "800" },
  personMeta: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  projectRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, backgroundColor: COLORS.surfaceSoft, borderWidth: 1, borderColor: COLORS.border },
  projectSwatch: { width: 12, height: 12, borderRadius: 4 },
  projectTaskList: { gap: 16 },
  projectTaskSection: { gap: 10 },
  projectTaskHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  projectTaskTitle: { flex: 1, color: COLORS.text, fontSize: 14, fontWeight: "900" },
  projectTaskCount: { minWidth: 28, textAlign: "center", color: COLORS.accent, backgroundColor: COLORS.accentSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, fontSize: 12, fontWeight: "900" },
  tabBar: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingVertical: 10, paddingBottom: Math.max(16, Platform.OS === "android" ? 18 : 10), backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border },
  tabItem: { alignItems: "center", gap: 4, minWidth: 54 },
  tabText: { color: COLORS.textMuted, fontSize: 11, fontWeight: "700" },
  tabTextActive: { color: COLORS.accent },
  iconButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.surfaceSoft, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.46)", justifyContent: "flex-end" },
  sheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, maxHeight: "92%" },
  sheetHead: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 14 },
  sheetKicker: { color: COLORS.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  sheetTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900", marginTop: 2 },
  sheetFoot: { marginTop: 10, flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  row2: { flexDirection: "row", gap: 10 },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  metaBox: { flexBasis: "48%", flexGrow: 1, padding: 12, borderRadius: 16, backgroundColor: COLORS.surfaceSoft, borderWidth: 1, borderColor: COLORS.border },
  metaLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", marginBottom: 6 },
  metaValue: { fontSize: 14, fontWeight: "800" },
  tabRow: { flexDirection: "row", gap: 8, marginTop: 16, marginBottom: 12, flexWrap: "wrap" },
  commentRow: { flexDirection: "row", gap: 10 },
  commentBubble: { padding: 12, borderRadius: 16, backgroundColor: COLORS.surfaceSoft, borderWidth: 1, borderColor: COLORS.border },
  commentMeta: { marginTop: 4, color: COLORS.textMuted, fontSize: 12 },
  commentComposer: { gap: 8, marginTop: 8 },
  activityRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  activityDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.accent, marginTop: 5 },
  toastStack: { position: "absolute", top: 14, left: 14, right: 14, gap: 8 },
  toast: { backgroundColor: COLORS.surface, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: COLORS.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, ...SHADOW },
  toastSuccess: { borderColor: "#bbf7d0", backgroundColor: "#f0fdf4" },
  toastInfo: { borderColor: "#bfdbfe", backgroundColor: "#eff6ff" },
  toastText: { flex: 1, color: COLORS.text, fontSize: 13, fontWeight: "700" }
});
