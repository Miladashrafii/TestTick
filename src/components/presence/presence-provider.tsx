"use client";

import * as React from "react";

/** Mirrors `PresenceEntry` from `@/lib/presence`, with dates already serialized. */
export type PresencePeer = {
  userId: string;
  userName: string;
  userEmail: string;
  page: string;
  label: string;
  updatedAt: string;
};

const HEARTBEAT_MS = 20_000;
const MAX_HEARTBEAT_MS = 5 * 60_000;

const EMPTY_PEERS: PresencePeer[] = [];

type PresenceContextValue = {
  peers: PresencePeer[];
  projectId: string | null;
};

const PresenceContext = React.createContext<PresenceContextValue>({
  peers: [],
  projectId: null,
});

/**
 * Heartbeats the current project + page so teammates show up in
 * `<PresenceAvatars />`. Pauses while the tab is hidden.
 */
export function PresenceProvider({
  projectId,
  page,
  currentUserId,
  label,
  children,
}: {
  projectId: string | null;
  page: string;
  currentUserId: string;
  label?: string;
  children: React.ReactNode;
}) {
  // Tagged with the project it came from so a navigation never shows stale peers.
  const [snapshot, setSnapshot] = React.useState<{
    projectId: string;
    peers: PresencePeer[];
  } | null>(null);

  React.useEffect(() => {
    if (!projectId) return;
    const activeProjectId = projectId;

    let cancelled = false;
    let failures = 0;
    let timer: number | undefined;
    const controller = new AbortController();

    // Presence is a nicety, so a failing endpoint backs off instead of being
    // polled every 20s for the lifetime of the page.
    function schedule() {
      if (cancelled) return;
      const delay = Math.min(HEARTBEAT_MS * 2 ** failures, MAX_HEARTBEAT_MS);
      timer = window.setTimeout(beat, delay);
    }

    async function beat() {
      if (cancelled) return;
      if (document.visibilityState === "hidden") {
        schedule();
        return;
      }
      try {
        const response = await fetch("/api/presence", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ projectId: activeProjectId, page, label }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as { active?: PresencePeer[] };
        if (cancelled) return;
        failures = 0;
        setSnapshot({
          projectId: activeProjectId,
          peers: (data.active ?? []).filter(
            (peer) => peer.userId !== currentUserId,
          ),
        });
      } catch {
        // Offline, unauthorized, or navigating away — retry, slower each time.
        failures += 1;
      }
      schedule();
    }

    function onVisible() {
      if (document.visibilityState !== "visible") return;
      window.clearTimeout(timer);
      void beat();
    }

    void beat();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [projectId, page, label, currentUserId]);

  const value = React.useMemo(
    () => ({
      peers: snapshot?.projectId === projectId ? snapshot.peers : EMPTY_PEERS,
      projectId,
    }),
    [snapshot, projectId],
  );

  return <PresenceContext value={value}>{children}</PresenceContext>;
}

export function usePresence(): PresenceContextValue {
  return React.useContext(PresenceContext);
}
