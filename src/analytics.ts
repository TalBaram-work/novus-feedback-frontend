import type { Visitor } from "./types";

interface PendoClient {
  initialize(metadata: {
    visitor: Record<string, string>;
    account: Record<string, string>;
  }): void;
  identify(metadata: {
    visitor: Record<string, string>;
    account: Record<string, string>;
  }): void;
  track(
    event: string,
    properties?: Record<string, string | number | boolean>,
  ): void;
}

declare global {
  interface Window {
    pendo?: PendoClient;
  }
}

let initialized = false;
let loading: Promise<PendoClient | null> | null = null;
let latestVisitor: Visitor | null = null;
const pendingEvents: Array<{
  event: string;
  properties?: Record<string, string | number | boolean>;
}> = [];

function metadata(visitor: Visitor) {
  return {
    visitor: {
      id: visitor.id,
      email: visitor.email,
      full_name: visitor.name,
      role: visitor.role,
    },
    account: {
      id: visitor.accountId,
      name: visitor.accountName,
      plan: visitor.plan,
    },
  };
}

export function identifyVisitor(visitor: Visitor): void {
  const apiKey = import.meta.env.VITE_PENDO_API_KEY;
  if (!apiKey) return;
  latestVisitor = visitor;

  if (window.pendo) {
    if (initialized) {
      window.pendo.identify(metadata(visitor));
    } else {
      window.pendo.initialize(metadata(visitor));
      initialized = true;
    }
    return;
  }

  loading ??= new Promise((resolve) => {
    const script = document.createElement("script");
    const host = import.meta.env.VITE_PENDO_CDN_HOST || "cdn.pendo.io";
    script.src = `https://${host}/agent/static/${apiKey}/pendo.js`;
    script.async = true;
    script.onload = () => resolve(window.pendo ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });

  void loading.then((client) => {
    if (!client || !latestVisitor) return;
    if (initialized) {
      client.identify(metadata(latestVisitor));
    } else {
      client.initialize(metadata(latestVisitor));
      initialized = true;
    }
    for (const pending of pendingEvents.splice(0)) {
      client.track(pending.event, pending.properties);
    }
  });
}

export function track(
  event: string,
  properties?: Record<string, string | number | boolean>,
): void {
  if (window.pendo && initialized) {
    window.pendo.track(event, properties);
    return;
  }
  pendingEvents.push({ event, properties });
}
