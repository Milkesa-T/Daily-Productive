const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export const getToken = (): string | null => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("access_token");
  }
  return null;
};

export const setToken = (token: string): void => {
  if (typeof window !== "undefined") {
    localStorage.setItem("access_token", token);
  }
};

export const removeToken = (): void => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("access_token");
  }
};

export async function loginUser(email: string, password: string) {
  // OAuth2PasswordRequestForm requires form-urlencoded data (username + password)
  const formData = new URLSearchParams();
  formData.append("username", email);
  formData.append("password", password);

  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Invalid email or password");
  }

  const data = await res.json();
  setToken(data.access_token);
  return data;
}

export async function registerUser(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Registration failed");
  }

  return await res.json();
}

export interface TaskItem {
  id: number;
  title: string;
  description?: string | null;
  due_date?: string | null;
  priority_level: string;
  category?: string | null;
  is_completed: boolean;
  reminder_id?: string | null;
  created_at: string;
}

export interface HabitItem {
  id: number;
  name: string;
  frequency_type: string;
  target_count: number;
  current_streak: number;
  created_at: string;
}
// --- TASK API CALLS ---
export async function fetchTasks(): Promise<TaskItem[]> {
  const res = await fetch(`${API_URL}/tasks`);
  if (!res.ok) throw new Error("Failed to fetch tasks");
  return res.json();
}
export async function createTask(task: {
  title: string;
  description?: string;
  due_date?: string;
  priority_level: string;
  category?: string;
}): Promise<TaskItem> {
  const res = await fetch(`${API_URL}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error("Failed to create task");
  return res.json();
}
export async function updateTask(
  id: number,
  data: Partial<TaskItem>,
): Promise<TaskItem> {
  const res = await fetch(`${API_URL}/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update task");
  return res.json();
}
export async function deleteTask(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/tasks/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete task");
}
// --- HABIT API CALLS ---
export async function fetchHabits(): Promise<HabitItem[]> {
  const res = await fetch(`${API_URL}/habits`);
  if (!res.ok) throw new Error("Failed to fetch habits");
  return res.json();
}
export async function createHabit(habit: {
  name: string;
  frequency_type: string;
  target_count: number;
}): Promise<HabitItem> {
  const res = await fetch(`${API_URL}/habits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(habit),
  });
  if (!res.ok) throw new Error("Failed to create habit");
  return res.json();
}
export async function updateHabit(
  id: number,
  data: Partial<HabitItem>,
): Promise<HabitItem> {
  const res = await fetch(`${API_URL}/habits/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update habit");
  return res.json();
}
export async function deleteHabit(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/habits/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete habit");
}
