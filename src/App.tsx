import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowUp,
  Lightbulb,
  MessageSquarePlus,
  Sparkles,
  Users,
} from "lucide-react";
import { createFeedback, getFeedback, getVisitors, setVote } from "./api";
import { identifyVisitor, track } from "./analytics";
import {
  feedbackCategories,
  isFeedbackCategory,
  type FeedbackCategory,
  type FeedbackItem,
  type FeedbackStatus,
  type Visitor,
} from "./types";
import "./styles.css";

const statusLabels: Record<FeedbackStatus, string> = {
  under_review: "Under review",
  planned: "Planned",
  shipped: "Shipped",
};

const filters: Array<{ value: FeedbackStatus | "all"; label: string }> = [
  { value: "all", label: "All ideas" },
  { value: "under_review", label: "Under review" },
  { value: "planned", label: "Planned" },
  { value: "shipped", label: "Shipped" },
];

// Error text for failure events, capped to stay within Pendo's property limits.
function errorMessageOf(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 100) : "unknown";
}

export default function App() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [selectedVisitorId, setSelectedVisitorId] = useState("");
  const [filter, setFilter] = useState<FeedbackStatus | "all">("all");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<FeedbackCategory>("platform");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pendingVotes, setPendingVotes] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [visitorData, feedbackData] = await Promise.all([
        getVisitors(),
        getFeedback(),
      ]);
      setVisitors(visitorData);
      setFeedback(feedbackData);
      setSelectedVisitorId((current) => current || visitorData[0]?.id || "");
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load feedback",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedVisitor = visitors.find(
    (visitor) => visitor.id === selectedVisitorId,
  );

  const identifiedVisitorRef = useRef<Visitor | null>(null);

  useEffect(() => {
    if (!selectedVisitor) return;
    identifyVisitor(selectedVisitor);
    // Tracked after identify so the switch is attributed to the new visitor
    // and account (the Pendo agent attaches their ids). Comparing ids skips the
    // initial default selection, Retry reloads and StrictMode effect re-runs.
    const previousVisitor = identifiedVisitorRef.current;
    identifiedVisitorRef.current = selectedVisitor;
    if (previousVisitor && previousVisitor.id !== selectedVisitor.id) {
      track("visitor_switched", {
        previousVisitorId: previousVisitor.id,
        previousAccountId: previousVisitor.accountId,
        previousPlan: previousVisitor.plan,
        plan: selectedVisitor.plan,
      });
    }
  }, [selectedVisitor]);

  const visibleFeedback = useMemo(
    () => feedback.filter((item) => filter === "all" || item.status === filter),
    [feedback, filter],
  );

  const totalVotes = feedback.reduce((sum, item) => sum + item.votes, 0);

  function handleFilterChange(nextFilter: FeedbackStatus | "all") {
    setFilter(nextFilter);
    // Re-clicking the already-active filter is not a change.
    if (nextFilter === filter) return;
    track("feedback_filter_changed", {
      filter: nextFilter,
      previousFilter: filter,
      // Ideas in the chosen stage; 0 means the empty state is shown.
      resultsCount: feedback.filter(
        (item) => nextFilter === "all" || item.status === nextFilter,
      ).length,
    });
  }

  async function handleVote(item: FeedbackItem) {
    if (!selectedVisitor) return;
    const voted = !item.voterIds.includes(selectedVisitor.id);
    setPendingVotes((current) => new Set(current).add(item.id));
    setError("");
    try {
      const updated = await setVote(item.id, selectedVisitor.id, voted);
      setFeedback((current) =>
        current.map((candidate) =>
          candidate.id === updated.id ? updated : candidate,
        ),
      );
      track("feedback_vote_toggled", {
        feedbackId: item.id,
        category: item.category,
        voted,
        status: item.status,
        // Authoritative tally from the backend, even if voterIds were stale.
        voteCount: updated.votes,
        isOwnIdea: item.authorId === selectedVisitor.id,
      });
    } catch (voteError: unknown) {
      setError(
        voteError instanceof Error
          ? voteError.message
          : "Could not update vote",
      );
      track("feedback_vote_failed", {
        feedbackId: item.id,
        category: item.category,
        status: item.status,
        voted,
        errorMessage: errorMessageOf(voteError),
      });
    } finally {
      setPendingVotes((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedVisitor) return;
    setSubmitting(true);
    setError("");
    // Trimmed lengths (never the free text), matching the API's validation.
    const titleLength = title.trim().length;
    const descriptionLength = description.trim().length;
    try {
      const created = await createFeedback({
        visitorId: selectedVisitor.id,
        title,
        description,
        category,
      });
      setFeedback((current) => [created, ...current]);
      setTitle("");
      setDescription("");
      setCategory("platform");
      setFilter("all");
      track("feedback_submitted", {
        feedbackId: created.id,
        category,
        titleLength,
        descriptionLength,
      });
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not submit feedback",
      );
      track("feedback_submission_failed", {
        category,
        titleLength,
        descriptionLength,
        errorMessage: errorMessageOf(submitError),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Pulseboard home">
          <span className="brand-mark">
            <Sparkles size={18} />
          </span>
          Pulseboard
        </a>
        <label className="visitor-picker">
          <span>Browsing as</span>
          <select
            value={selectedVisitorId}
            onChange={(event) => setSelectedVisitorId(event.target.value)}
          >
            {visitors.map((visitor) => (
              <option key={visitor.id} value={visitor.id}>
                {visitor.name} · {visitor.accountName}
              </option>
            ))}
          </select>
        </label>
      </header>

      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">Customer-powered roadmap</p>
            <h1>Shape what we build next.</h1>
            <p className="hero-copy">
              Share your ideas, vote on what matters, and follow every request
              from consideration to launch.
            </p>
          </div>
          <div
            className="hero-stats"
            role="group"
            aria-label="Community activity"
          >
            <div>
              <Lightbulb size={20} />
              <strong>{feedback.length}</strong>
              <span>Ideas</span>
            </div>
            <div>
              <ArrowUp size={20} />
              <strong>{totalVotes}</strong>
              <span>Votes</span>
            </div>
            <div>
              <Users size={20} />
              <strong>{visitors.length}</strong>
              <span>Visitors</span>
            </div>
          </div>
        </section>

        {selectedVisitor && (
          <section className="visitor-banner">
            <div className="avatar">{selectedVisitor.name.charAt(0)}</div>
            <div>
              <strong>Welcome, {selectedVisitor.name.split(" ")[0]}</strong>
              <span>
                {selectedVisitor.role} at {selectedVisitor.accountName} ·{" "}
                {selectedVisitor.plan} plan
              </span>
            </div>
          </section>
        )}

        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => void loadData()}>
              Retry
            </button>
          </div>
        )}

        <div className="content-grid">
          <section className="feed">
            <div className="feed-header">
              <div>
                <p className="eyebrow">Product feedback</p>
                <h2>Ideas from the community</h2>
              </div>
              <div
                className="filters"
                role="group"
                aria-label="Filter feedback"
              >
                {filters.map((option) => (
                  <button
                    key={option.value}
                    className={filter === option.value ? "active" : ""}
                    aria-pressed={filter === option.value}
                    onClick={() => handleFilterChange(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="feedback-list">
              {loading ? (
                <div className="empty-state" role="status">
                  <Sparkles size={28} />
                  <h3>Loading community ideas</h3>
                  <p>Gathering the latest feedback and votes.</p>
                </div>
              ) : (
                visibleFeedback.map((item) => {
                  const hasVoted = selectedVisitor
                    ? item.voterIds.includes(selectedVisitor.id)
                    : false;
                  return (
                    <article className="feedback-card" key={item.id}>
                      <button
                        className={`vote-button ${hasVoted ? "voted" : ""}`}
                        aria-label={`${hasVoted ? "Remove vote from" : "Vote for"} ${item.title}, ${item.votes} votes`}
                        aria-pressed={hasVoted}
                        disabled={pendingVotes.has(item.id)}
                        onClick={() => void handleVote(item)}
                      >
                        <ArrowUp size={18} />
                        <strong>{item.votes}</strong>
                      </button>
                      <div className="feedback-content">
                        <div className="feedback-meta">
                          <span className={`status status-${item.status}`}>
                            {statusLabels[item.status]}
                          </span>
                          <span>{item.category}</span>
                        </div>
                        <h3>{item.title}</h3>
                        <p>{item.description}</p>
                        <footer>
                          Suggested by {item.author.name} ·{" "}
                          {item.author.accountName}
                        </footer>
                      </div>
                    </article>
                  );
                })
              )}
              {!loading && visibleFeedback.length === 0 && !error && (
                <div className="empty-state">
                  <Lightbulb size={28} />
                  <h3>No ideas in this stage yet</h3>
                  <p>Choose another filter or submit the first one.</p>
                </div>
              )}
            </div>
          </section>

          <aside className="submit-card">
            <span className="submit-icon">
              <MessageSquarePlus size={20} />
            </span>
            <p className="eyebrow">Have an idea?</p>
            <h2>Help improve Pulseboard</h2>
            <p>Tell the product team what would make your work easier.</p>
            <form onSubmit={(event) => void handleSubmit(event)}>
              <label>
                Title
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  minLength={4}
                  maxLength={120}
                  placeholder="A short, specific idea"
                  required
                />
              </label>
              <label>
                Category
                <select
                  value={category}
                  onChange={(event) => {
                    if (isFeedbackCategory(event.target.value)) {
                      setCategory(event.target.value);
                    }
                  }}
                >
                  {feedbackCategories.map((option) => (
                    <option key={option} value={option}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Why is this useful?
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  minLength={10}
                  maxLength={600}
                  placeholder="Describe the problem this would solve"
                  rows={5}
                  required
                />
              </label>
              <button
                className="submit-button"
                disabled={submitting || !selectedVisitor}
              >
                {submitting ? "Submitting…" : "Submit idea"}
              </button>
            </form>
          </aside>
        </div>
      </main>
    </div>
  );
}
