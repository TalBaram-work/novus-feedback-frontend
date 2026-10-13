import type {
  FeedbackItem,
  FeedbackStatus,
  NewFeedback,
  Visitor,
} from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      payload?.error ?? `Request failed with status ${response.status}`,
    );
  }
  return response.json() as Promise<T>;
}

export async function getVisitors(): Promise<Visitor[]> {
  return (await request<{ visitors: Visitor[] }>("/api/visitors")).visitors;
}

export async function getFeedback(
  status?: FeedbackStatus,
): Promise<FeedbackItem[]> {
  const query = status ? `?status=${status}` : "";
  return (await request<{ feedback: FeedbackItem[] }>(`/api/feedback${query}`))
    .feedback;
}

export async function createFeedback(
  input: NewFeedback,
): Promise<FeedbackItem> {
  return (
    await request<{ feedback: FeedbackItem }>("/api/feedback", {
      method: "POST",
      body: JSON.stringify(input),
    })
  ).feedback;
}

export async function setVote(
  feedbackId: string,
  visitorId: string,
  voted: boolean,
): Promise<FeedbackItem> {
  return (
    await request<{ feedback: FeedbackItem }>(
      `/api/feedback/${encodeURIComponent(feedbackId)}/vote`,
      {
        method: "PUT",
        body: JSON.stringify({ visitorId, voted }),
      },
    )
  ).feedback;
}
