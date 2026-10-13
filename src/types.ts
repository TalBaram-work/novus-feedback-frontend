export type FeedbackStatus = "under_review" | "planned" | "shipped";
export const feedbackCategories = [
  "analytics",
  "collaboration",
  "platform",
] as const;
export type FeedbackCategory = (typeof feedbackCategories)[number];

export function isFeedbackCategory(value: string): value is FeedbackCategory {
  return feedbackCategories.some((category) => category === value);
}

export interface Visitor {
  id: string;
  name: string;
  email: string;
  accountId: string;
  accountName: string;
  plan: "Starter" | "Growth" | "Enterprise";
  role: string;
  joinedAt: string;
}

export interface FeedbackUpdate {
  id: string;
  message: string;
  createdAt: string;
}

export interface FeedbackItem {
  id: string;
  title: string;
  description: string;
  category: FeedbackCategory;
  status: FeedbackStatus;
  authorId: string;
  author: Visitor;
  voterIds: string[];
  votes: number;
  updates: FeedbackUpdate[];
  createdAt: string;
}

export interface NewFeedback {
  visitorId: string;
  title: string;
  description: string;
  category: FeedbackCategory;
}
