"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTimeStore } from "@/store/useTimeStore";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const setUserId = useTimeStore((s) => s.setUserId);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
      setIsReady(true);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, [setUserId]);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-[#f8f8fa] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-lg font-black tracking-tight text-gray-900 select-none">
            tt<span className="text-indigo-500">.</span>
          </h1>
          <div className="w-32 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full w-1/3 bg-indigo-400 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const userId = useTimeStore((s) => s.userId);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (userId) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#f8f8fa] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black tracking-tight text-gray-900">
            tt<span className="text-indigo-500">.</span>
          </h1>
          <p className="text-sm text-gray-400 mt-2">
            {isSignUp ? "Create an account" : "Sign in to continue"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              minLength={6}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          {error && (
            <div className="text-red-500 text-xs text-center">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-500 text-white font-bold text-sm rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "..." : isSignUp ? "Sign Up" : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="text-xs text-gray-400 hover:text-indigo-500 transition-colors"
          >
            {isSignUp
              ? "Already have an account? Sign in"
              : "Don't have an account? Sign up"}
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100">
          <button
            onClick={() => useTimeStore.getState().setUserId("demo")}
            className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Continue without account (local only)
          </button>
        </div>
      </div>
    </div>
  );
}

export function SignOutButton() {
  const userId = useTimeStore((s) => s.userId);

  if (!userId || userId === "demo") return null;

  return (
    <button
      onClick={() => supabase.auth.signOut()}
      className="text-[10px] text-gray-300 hover:text-gray-500 transition-colors font-medium"
    >
      Sign out
    </button>
  );
}
