import { useState, useEffect, useCallback } from "react";

export interface NameVerificationResult {
  name: string;
  chineseName?: string;
  reason?: string;
  githubAvailable?: boolean;
  domains?: {
    com: boolean | null;
    cn: boolean | null;
    io: boolean | null;
    app: boolean | null;
    dev: boolean | null;
    ai: boolean | null;
  };
  scores?: {
    githubScore: number;
    domainScore: number;
    lengthBonus: number;
    totalScore: number;
  };
  verified?: boolean;
}

export interface HistorySession {
  id: string;
  timestamp: number;
  productIdea: string;
  targetUsers: string[];
  productPositioning: string;
  generatedNames: NameVerificationResult[];
}

const STORAGE_KEY = "buildnames_history";
const MAX_SESSIONS = 50;

export function useHistoryStorage() {
  const [history, setHistory] = useState<HistorySession[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (err) {
      console.error("Failed to load history from localStorage:", err);
    }
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (err) {
      console.error("Failed to save history to localStorage:", err);
    }
  }, [history]);

  const saveSession = useCallback(
    (session: Omit<HistorySession, "id" | "timestamp">) => {
      const newSession: HistorySession = {
        ...session,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };

      setHistory((prev) => {
        const updated = [newSession, ...prev];
        // Keep only the most recent MAX_SESSIONS
        return updated.slice(0, MAX_SESSIONS);
      });

      return newSession.id;
    },
    []
  );

  const deleteSession = useCallback((id: string) => {
    setHistory((prev) => prev.filter((session) => session.id !== id));
  }, []);

  const clearAllHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return {
    history,
    saveSession,
    deleteSession,
    clearAllHistory,
  };
}
