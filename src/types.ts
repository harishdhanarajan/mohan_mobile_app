export type Role = "admin" | "user";
export type Status = "todo" | "in-progress" | "review" | "blocked" | "done";
export type Priority = "high" | "medium" | "low";

export type Profile = {
  id: string;
  auth_user_id: string | null;
  name: string;
  email: string;
  password: string;
  role: Role;
  title: string | null;
};

export type Project = {
  id: string;
  name: string;
  color: string;
};

export type Comment = {
  id: string;
  authorId: string;
  ts: string;
  text: string;
};

export type Activity = {
  ts: string;
  actor: string;
  text: string;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  assigneeId: string | null;
  projectId: string | null;
  priority: Priority;
  status: Status;
  startDate: string | null;
  dueDate: string | null;
  tags: string[];
  attachments: { name: string; size: string }[];
  comments: Comment[];
  activity: Activity[];
};

export type NotificationItem = {
  id: string;
  ts: string;
  actorId: string | null;
  taskId: string | null;
  kind: string;
  text: string;
  read: boolean;
};

export type WorkspaceState = {
  users: Profile[];
  projects: Project[];
  tasks: Task[];
  notifications: NotificationItem[];
};

export type SelectOption = {
  label: string;
  value: string;
};
