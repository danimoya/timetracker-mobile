import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Mode = "login" | "register";

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Authentication failed");
      }
      const data = await response.json();
      if (data.token) {
        localStorage.setItem("token", data.token);
        if (data.user?.email) localStorage.setItem("userEmail", data.user.email);
        navigate("/");
        window.location.reload();
      } else {
        throw new Error("No token received");
      }
    } catch (e: any) {
      setError(e.message || "Could not sign you in");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grain relative min-h-[100dvh] flex items-stretch">
      <div className="mx-auto w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        {/* =========== LEFT: Editorial masthead =========== */}
        <aside className="hidden lg:flex flex-col justify-between p-12 border-r border-rule relative">
          <div>
            <div className="eyebrow text-vermilion">Est. MMXXVI · Vol. I</div>
            <h1 className="mt-4 font-display text-[84px] leading-[0.95] font-light">
              <span className="italic">Time</span>
              <br />
              <span className="font-semibold">Tracker</span>
              <span className="text-vermilion">.</span>
            </h1>
            <div className="mt-8 max-w-sm font-serif text-lg leading-relaxed text-ink-muted">
              A daily chronicle of hours spent — a private ledger, printed in
              ink, kept in confidence.
            </div>
          </div>

          <div>
            <div className="fleuron max-w-xs mb-6">❧</div>
            <blockquote className="font-display italic text-xl text-ink max-w-sm leading-snug">
              “Lost time is never found again.”
            </blockquote>
            <div className="mt-3 eyebrow text-[10px]">— B. Franklin</div>
          </div>

          {/* Ornamental tick column */}
          <div className="absolute right-6 top-12 bottom-12 w-px flex flex-col justify-between">
            {Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                className="w-2 h-px bg-ink/20"
                style={{ alignSelf: i % 6 === 0 ? "stretch" : "flex-end" }}
              />
            ))}
          </div>
        </aside>

        {/* =========== RIGHT: Form card =========== */}
        <main className="flex items-center justify-center p-5 sm:p-10 relative">
          <div className="w-full max-w-[420px] animate-ink-fade-in">
            {/* Mobile masthead */}
            <div className="lg:hidden text-center mb-8">
              <div className="eyebrow text-vermilion">Vol. I</div>
              <h1 className="mt-2 font-display text-5xl font-light">
                <span className="italic">Time</span>
                <span className="font-semibold">Tracker</span>
                <span className="text-vermilion">.</span>
              </h1>
              <div className="mt-4 font-display italic text-ink-muted text-sm">
                A daily chronicle of hours spent
              </div>
            </div>

            {/* Form paper */}
            <div className="paper p-6 sm:p-8 relative">
              <div className="absolute top-2 left-2 w-3 h-3 border-l border-t border-ink/30" />
              <div className="absolute top-2 right-2 w-3 h-3 border-r border-t border-ink/30" />
              <div className="absolute bottom-2 left-2 w-3 h-3 border-l border-b border-ink/30" />
              <div className="absolute bottom-2 right-2 w-3 h-3 border-r border-b border-ink/30" />

              {/* Mode toggle */}
              <div className="flex items-center gap-0 mb-6 border-b border-ink/70">
                <button
                  onClick={() => setMode("login")}
                  className={`flex-1 py-3 font-display text-lg tracking-tight transition-colors relative ${
                    mode === "login" ? "text-ink" : "text-ink-muted"
                  }`}
                >
                  Sign in
                  {mode === "login" && (
                    <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-vermilion" />
                  )}
                </button>
                <span className="h-6 w-px bg-rule" />
                <button
                  onClick={() => setMode("register")}
                  className={`flex-1 py-3 font-display text-lg italic tracking-tight transition-colors relative ${
                    mode === "register" ? "text-ink" : "text-ink-muted"
                  }`}
                >
                  Enlist
                  {mode === "register" && (
                    <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-vermilion" />
                  )}
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
                className="space-y-5"
              >
                <div>
                  <label className="eyebrow block mb-2">Correspondence</label>
                  <Input
                    type="email"
                    placeholder="name@house.domain"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="h-12 rounded-sm border-ink/30 bg-transparent font-serif text-base placeholder:text-ink-muted placeholder:italic focus-visible:ring-0 focus-visible:border-vermilion"
                  />
                </div>
                <div>
                  <label className="eyebrow block mb-2">
                    Secret hand
                  </label>
                  <Input
                    type="password"
                    placeholder="six letters, at least"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    minLength={6}
                    className="h-12 rounded-sm border-ink/30 bg-transparent font-serif text-base placeholder:text-ink-muted placeholder:italic focus-visible:ring-0 focus-visible:border-vermilion"
                  />
                </div>

                {error && (
                  <div className="border border-vermilion/40 bg-vermilion/10 px-3 py-2 text-sm font-serif italic text-vermilion">
                    ⚠ {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={busy || !email || !password}
                  className="w-full h-12 rounded-sm font-display tracking-tight uppercase text-base bg-ink text-parchment hover:bg-vermilion"
                >
                  {busy ? (
                    <span className="eyebrow">One moment…</span>
                  ) : mode === "login" ? (
                    "Open the ledger"
                  ) : (
                    "Begin your chronicle"
                  )}
                </Button>
              </form>

              <div className="mt-6 fleuron text-xs">
                <span className="font-display italic">⁂</span>
              </div>
            </div>

            <p className="mt-6 text-center eyebrow text-[10px] text-ink-muted">
              {mode === "login"
                ? "Previously enlisted · your pages await"
                : "New scribe · a fresh volume will be opened"}
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
