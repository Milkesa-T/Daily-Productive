const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export const getToken = (): string | null => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (!token) return null;
    try {
      // Proactively check if the JWT has expired
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        removeToken();
        return null;
      }
    } catch {
      removeToken();
      return null;
    }
    return token;
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
    localStorage.removeItem("user_email");
  }
};

export const getUserEmail = (): string | null => {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("user_email");
    if (stored) return stored;
    const token = getToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload.sub || null;
      } catch {
        return null;
      }
    }
  }
  return null;
};

export const logoutUser = (): void => {
  removeToken();
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
};

export const getAuthHeaders = (contentType: string = "application/json"): HeadersInit => {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (contentType) headers["Content-Type"] = contentType;
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
};

async function handleResponse<T>(res: Response, fallbackError: string): Promise<T> {
  if (res.status === 401) {
    removeToken();
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    throw new Error("Session expired. Please log in again.");
  }
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || fallbackError);
  }
  return res.json();
}

async function handleEmptyResponse(res: Response, fallbackError: string): Promise<void> {
  if (res.status === 401) {
    removeToken();
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    throw new Error("Session expired. Please log in again.");
  }
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || fallbackError);
  }
}

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
  if (typeof window !== "undefined") {
    localStorage.setItem("user_email", email);
  }
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
  goal_id?: number | null;
  category_id?: number | null;
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

export interface GoalItem {
  id: number;
  title: string;
  description?: string | null;
  start_date?: string | null;
  target_date?: string | null;
  progress_percentage: number;
  total_tasks: number;
  completed_tasks: number;
  created_at: string;
  updated_at: string;
}

export interface GoalCreateInput {
  title: string;
  description?: string;
  start_date?: string;
  target_date?: string;
}

export interface GoalUpdateInput {
  title?: string;
  description?: string;
  start_date?: string;
  target_date?: string;
}

// --- TASK API CALLS ---
export async function fetchTasks(): Promise<TaskItem[]> {
  const res = await fetch(`${API_URL}/tasks`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<TaskItem[]>(res, "Failed to fetch tasks");
}
export async function createTask(task: {
  title: string;
  description?: string;
  due_date?: string;
  priority_level: string;
  category?: string;
  goal_id?: number | null;
}): Promise<TaskItem> {
  const res = await fetch(`${API_URL}/tasks`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(task),
  });
  return handleResponse<TaskItem>(res, "Failed to create task");
}
export async function updateTask(
  id: number,
  data: Partial<TaskItem>,
): Promise<TaskItem> {
  const res = await fetch(`${API_URL}/tasks/${id}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<TaskItem>(res, "Failed to update task");
}
export async function deleteTask(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/tasks/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleEmptyResponse(res, "Failed to delete task");
}
// --- HABIT API CALLS ---
export async function fetchHabits(): Promise<HabitItem[]> {
  const res = await fetch(`${API_URL}/habits`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<HabitItem[]>(res, "Failed to fetch habits");
}
export async function createHabit(habit: {
  name: string;
  frequency_type: string;
  target_count: number;
}): Promise<HabitItem> {
  const res = await fetch(`${API_URL}/habits`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(habit),
  });
  return handleResponse<HabitItem>(res, "Failed to create habit");
}
export async function updateHabit(
  id: number,
  data: Partial<HabitItem>,
): Promise<HabitItem> {
  const res = await fetch(`${API_URL}/habits/${id}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<HabitItem>(res, "Failed to update habit");
}
export async function deleteHabit(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/habits/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleEmptyResponse(res, "Failed to delete habit");
}

// --- GOAL API CALLS ---
export async function fetchGoals(): Promise<GoalItem[]> {
  const res = await fetch(`${API_URL}/goals`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<GoalItem[]>(res, "Failed to fetch goals");
}

export async function createGoal(goal: GoalCreateInput): Promise<GoalItem> {
  const res = await fetch(`${API_URL}/goals`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(goal),
  });
  return handleResponse<GoalItem>(res, "Failed to create goal");
}

export async function updateGoal(
  id: number,
  data: GoalUpdateInput,
): Promise<GoalItem> {
  const res = await fetch(`${API_URL}/goals/${id}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<GoalItem>(res, "Failed to update goal");
}

export async function deleteGoal(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/goals/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleEmptyResponse(res, "Failed to delete goal");
}

// --- DASHBOARD API CALLS ---

export interface DashboardTaskItem {
  id: number;
  title: string;
  priority_level: string;
  due_date?: string | null;
  is_completed: boolean;
  is_overdue: boolean;
  goal_id?: number | null;
  category_id?: number | null;
}

export interface DashboardHabitItem {
  id: number;
  name: string;
  frequency_type: string;
  target_count: number;
  current_streak: number;
  longest_streak: number;
  completed_today: boolean;
  category_id?: number | null;
}

export interface DashboardGoal {
  id: number;
  title: string;
  progress_percentage: number;
  total_tasks: number;
  completed_tasks: number;
}

export interface DashboardSummary {
  today: string;
  tasks: {
    total_today: number;
    completed_today: number;
    overdue_count: number;
    items: DashboardTaskItem[];
  };
  habits: {
    total_habits: number;
    completed_today: number;
    items: DashboardHabitItem[];
  };
  goals: DashboardGoal[];
  weekly_completion_rate: number;
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const res = await fetch(`${API_URL}/dashboard/summary`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<DashboardSummary>(res, "Failed to fetch dashboard summary");
}

export async function toggleHabitToday(habitId: number): Promise<{
  id: number;
  completed_today: boolean;
  current_streak: number;
  longest_streak: number;
  message: string;
}> {
  const res = await fetch(`${API_URL}/habits/${habitId}/toggle-today`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return handleResponse<{
    id: number;
    completed_today: boolean;
    current_streak: number;
    longest_streak: number;
    message: string;
  }>(res, "Failed to toggle habit");
}

export async function fetchHabitHistory(habitId: number): Promise<string[]> {
  const res = await fetch(`${API_URL}/habits/${habitId}/history`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<string[]>(res, "Failed to fetch habit history");
}

// --- RAG / CHAT API CALLS ---
export interface ChatSource {
  id: number;
  title?: string | null;
  chunk_index?: number;
  similarity?: number;
  snippet: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  timestamp: string;
}

export interface AskJournalResponse {
  question: string;
  answer: string;
  sources: ChatSource[];
}

export async function askJournal(question: string): Promise<AskJournalResponse> {
  const res = await fetch(`${API_URL}/journal/ask`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ question }),
  });
  return handleResponse<AskJournalResponse>(res, "Failed to get an answer from the assistant");
}

