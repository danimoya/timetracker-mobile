
import { TimeEntry } from "../../../db/schema";

const API_BASE = "/api";

let customersPromise: Promise<any> | null = null;

export async function getCustomers() {
  try {
    const response = await fetch(`${API_BASE}/customers`, {
      headers: getAuthHeader(),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching customers:', error);
    throw error;
  }
}

// Convert dates to strings for client-side use
export type ClientTimeEntry = Omit<TimeEntry, 'checkIn' | 'checkOut' | 'createdAt' | 'updatedAt'> & {
  checkIn: string;
  checkOut: string | null;
  createdAt: string;
  updatedAt: string;
};

const getAuthHeader = (): Record<string, string> => {
  const token = localStorage.getItem("token");
  const workspaceId = localStorage.getItem("workspaceId");
  const base: Record<string, string> = { "Content-Type": "application/json" };
  if (token) base["Authorization"] = `Bearer ${token}`;
  if (workspaceId) base["X-Workspace-Id"] = workspaceId;
  return base;
};

export { getAuthHeader };

export interface WorkspaceSummary {
  id: number;
  name: string;
  ownerId: number;
  role: "owner" | "admin" | "member";
  createdAt: string;
}

export async function getWorkspaces(): Promise<WorkspaceSummary[]> {
  const response = await fetch(`${API_BASE}/workspaces`, { headers: getAuthHeader() });
  if (!response.ok) throw new Error("Failed to fetch workspaces");
  return response.json();
}

export async function createWorkspace(name: string): Promise<WorkspaceSummary> {
  const response = await fetch(`${API_BASE}/workspaces`, {
    method: "POST",
    headers: getAuthHeader(),
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error("Failed to create workspace");
  return response.json();
}

export async function getWorkspaceMembers(workspaceId: number) {
  const response = await fetch(`${API_BASE}/workspaces/${workspaceId}/members`, {
    headers: { ...getAuthHeader(), "X-Workspace-Id": workspaceId.toString() },
  });
  if (!response.ok) throw new Error("Failed to fetch members");
  return response.json();
}

export async function inviteMember(
  workspaceId: number,
  email: string,
  role: "admin" | "member"
) {
  const response = await fetch(`${API_BASE}/workspaces/${workspaceId}/invitations`, {
    method: "POST",
    headers: { ...getAuthHeader(), "X-Workspace-Id": workspaceId.toString() },
    body: JSON.stringify({ email, role }),
  });
  if (!response.ok) throw new Error("Failed to invite");
  return response.json();
}

export async function acceptInvitation(token: string) {
  const response = await fetch(`${API_BASE}/invitations/accept`, {
    method: "POST",
    headers: getAuthHeader(),
    body: JSON.stringify({ token }),
  });
  if (!response.ok) throw new Error("Failed to accept");
  return response.json();
}

export async function removeMember(workspaceId: number, userId: number) {
  const response = await fetch(`${API_BASE}/workspaces/${workspaceId}/members/${userId}`, {
    method: "DELETE",
    headers: { ...getAuthHeader(), "X-Workspace-Id": workspaceId.toString() },
  });
  if (!response.ok) throw new Error("Failed to remove member");
}

export async function updateMemberRole(
  workspaceId: number,
  userId: number,
  role: "owner" | "admin" | "member"
) {
  const response = await fetch(`${API_BASE}/workspaces/${workspaceId}/members/${userId}`, {
    method: "PATCH",
    headers: { ...getAuthHeader(), "X-Workspace-Id": workspaceId.toString() },
    body: JSON.stringify({ role }),
  });
  if (!response.ok) throw new Error("Failed to update role");
  return response.json();
}

export async function getTimeEntries(): Promise<ClientTimeEntry[]> {
  const response = await fetch(`${API_BASE}/time-entries`, {
    headers: getAuthHeader()
  });
  if (!response.ok) {
    throw new Error("Failed to fetch time entries");
  }
  const entries: TimeEntry[] = await response.json();
  return entries.map(entry => ({
    ...entry,
    checkIn: entry.checkIn.toString(),
    checkOut: entry.checkOut?.toString() || null,
    createdAt: entry.createdAt.toString(),
    updatedAt: entry.updatedAt.toString(),
  }));
}

export interface Project {
  id: number;
  name: string;
  color: string | null;
  archived: boolean;
  customerId: number | null;
  customerName: string | null;
  createdAt: string;
}

export async function getProjects(customerId?: number): Promise<Project[]> {
  const qs = customerId != null ? `?customerId=${customerId}` : "";
  const response = await fetch(`${API_BASE}/projects${qs}`, { headers: getAuthHeader() });
  if (!response.ok) throw new Error("Failed to fetch projects");
  return response.json();
}

export async function createProject(data: {
  name: string;
  customerId?: number | null;
  color?: string | null;
}): Promise<Project> {
  const response = await fetch(`${API_BASE}/projects`, {
    method: "POST",
    headers: getAuthHeader(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to create project");
  return response.json();
}

export async function updateProject(
  id: number,
  data: Partial<{ name: string; customerId: number | null; color: string | null; archived: boolean }>
): Promise<Project> {
  const response = await fetch(`${API_BASE}/projects/${id}`, {
    method: "PATCH",
    headers: getAuthHeader(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to update project");
  return response.json();
}

export async function deleteProject(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/projects/${id}`, {
    method: "DELETE",
    headers: getAuthHeader(),
  });
  if (!response.ok) throw new Error("Failed to delete project");
}

export async function createTimeEntry(data: {
  isBreak: boolean;
  customerId?: number;
  projectId?: number;
  notes?: string;
}): Promise<ClientTimeEntry> {
  const response = await fetch(`${API_BASE}/time-entries`, {
    method: "POST",
    headers: getAuthHeader(),
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error("Failed to create time entry");
  }
  
  const entry: TimeEntry = await response.json();
  return {
    ...entry,
    checkIn: entry.checkIn.toString(),
    checkOut: entry.checkOut?.toString() || null,
    createdAt: entry.createdAt.toString(),
    updatedAt: entry.updatedAt.toString(),
  };
}

export async function updateTimeEntry(data: { id: number; checkOut: string }): Promise<ClientTimeEntry> {
  const response = await fetch(`${API_BASE}/time-entries/${data.id}`, {
    method: "PATCH",
    headers: getAuthHeader(),
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error("Failed to update time entry");
  }
  
  const entry: TimeEntry = await response.json();
  return {
    ...entry,
    checkIn: entry.checkIn.toString(),
    checkOut: entry.checkOut?.toString() || null,
    createdAt: entry.createdAt.toString(),
    updatedAt: entry.updatedAt.toString(),
  };
}

export interface EntryTemplate {
  id: number;
  name: string;
  customerId: number | null;
  projectId?: number | null;
  notes: string | null;
  icon: string | null;
  isBreak: boolean;
}

export async function getEntryTemplates(): Promise<EntryTemplate[]> {
  const response = await fetch(`${API_BASE}/entry-templates`, {
    headers: getAuthHeader(),
  });
  if (!response.ok) throw new Error("Failed to fetch templates");
  return response.json();
}

export async function createEntryTemplate(data: {
  name: string;
  customerId?: number | null;
  projectId?: number | null;
  notes?: string | null;
  icon?: string | null;
  isBreak?: boolean;
}): Promise<EntryTemplate> {
  const response = await fetch(`${API_BASE}/entry-templates`, {
    method: "POST",
    headers: getAuthHeader(),
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to create template");
  return response.json();
}

export async function deleteEntryTemplate(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/entry-templates/${id}`, {
    method: "DELETE",
    headers: getAuthHeader(),
  });
  if (!response.ok) throw new Error("Failed to delete template");
}

export async function updateCustomer(
  id: number,
  data: Partial<{ name: string; weeklyGoalHours: number | null; billingAddress: string | null; billingEmail: string | null }>
) {
  const response = await fetch(`${API_BASE}/customers/${id}`, {
    method: "PATCH",
    headers: getAuthHeader(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Failed to update customer");
  }
  return response.json();
}

export async function deleteCustomer(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/customers/${id}`, {
    method: "DELETE",
    headers: getAuthHeader(),
  });
  if (!response.ok) {
    throw new Error("Failed to delete customer");
  }
}

export async function deleteTimeEntry(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/time-entries/${id}`, {
    method: "DELETE",
    headers: getAuthHeader(),
  });
  if (!response.ok) {
    throw new Error("Failed to delete time entry");
  }
}

export async function createCustomer(customerData: {
  name: string, 
  weeklyGoalHours?: number, 
  billingAddress?: string, 
  billingEmail?: string 
}) {
  const response = await fetch(`${API_BASE}/customers`, {
    method: "POST",
    headers: getAuthHeader(),
    body: JSON.stringify(customerData),
  });

  if (!response.ok) {
    throw new Error("Failed to create customer");
  }
  
  return response.json();
}
