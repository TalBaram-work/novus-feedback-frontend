import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import type { FeedbackItem, Visitor } from "./types";

const visitor = {
  id: "visitor-maya",
  name: "Maya Chen",
  email: "maya@example.com",
  accountId: "account-northstar",
  accountName: "Northstar Labs",
  plan: "Enterprise",
  role: "Product manager",
  joinedAt: "2026-01-12T09:00:00.000Z",
} satisfies Visitor;

const feedback = {
  id: "feedback-1",
  title: "Export the roadmap to CSV",
  description: "Let our operations team share roadmap data.",
  category: "analytics",
  status: "planned",
  authorId: visitor.id,
  author: visitor,
  voterIds: [visitor.id],
  votes: 1,
  updates: [],
  createdAt: "2026-08-04T09:20:00.000Z",
} satisfies FeedbackItem;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Pulseboard", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/visitors")) {
          return Promise.resolve(jsonResponse({ visitors: [visitor] }));
        }
        if (url.endsWith("/api/feedback") && init?.method === "POST") {
          return Promise.resolve(
            jsonResponse(
              {
                feedback: {
                  ...feedback,
                  id: "feedback-new",
                  title: "Saved views",
                  description: "Let teams save their preferred filters.",
                },
              },
              201,
            ),
          );
        }
        if (url.endsWith("/api/feedback")) {
          return Promise.resolve(jsonResponse({ feedback: [feedback] }));
        }
        if (url.endsWith("/vote")) {
          return Promise.resolve(
            jsonResponse({ feedback: { ...feedback, voterIds: [], votes: 0 } }),
          );
        }
        return Promise.reject(new Error(`Unexpected request: ${url}`));
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows seeded visitors and feedback", async () => {
    render(<App />);

    expect(await screen.findByText("Export the roadmap to CSV")).toBeVisible();
    expect(screen.getByText(/Welcome, Maya/)).toBeVisible();
    expect(screen.getByRole("option", { name: /Maya Chen/ })).toBeVisible();
  });

  it("lets the selected visitor submit an idea", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Export the roadmap to CSV");

    await user.type(screen.getByLabelText("Title"), "Saved views");
    await user.type(
      screen.getByLabelText("Why is this useful?"),
      "Let teams save their preferred filters.",
    );
    await user.click(screen.getByRole("button", { name: "Submit idea" }));

    await waitFor(() => expect(screen.getByText("Saved views")).toBeVisible());
  });

  it("sets the selected visitor's desired vote state", async () => {
    const user = userEvent.setup();
    render(<App />);

    const removeVote = await screen.findByRole("button", {
      name: /Remove vote from Export the roadmap to CSV, 1 votes/,
    });
    await user.click(removeVote);

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: /Vote for Export the roadmap to CSV, 0 votes/,
        }),
      ).toBeVisible(),
    );
  });
});
