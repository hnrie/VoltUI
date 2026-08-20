import { useState } from "react";
import type { FormEvent } from "react";
import { LOCAL_PASSWORD, LOCAL_USERNAME } from "../../auth/localAuth";
import type { AuthUser } from "../runtime/authClient";
import { login, storeSession } from "../runtime/authClient";
import { BoltIcon } from "../components/Icons";

export function LoginScreen({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await login(username, password);
      storeSession(result);
      onAuthenticated(result.user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <BoltIcon size={30} />
          <h1>Volt</h1>
          <p>Sign in to continue</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <div className="field">
          <label htmlFor="login-username">Username</label>
          <input
            id="login-username"
            type="text"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={event => setUsername(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={event => setPassword(event.target.value)}
          />
        </div>

        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <p className="login-hint">
          Local account: <span className="mono">{LOCAL_USERNAME}</span> /{" "}
          <span className="mono">{LOCAL_PASSWORD}</span>
        </p>
      </form>
    </div>
  );
}
