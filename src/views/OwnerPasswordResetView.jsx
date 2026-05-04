import { useEffect, useState } from "react";
import { handleAppLinkClick } from "../lib/navigation.js";
import { supabase } from "../utils/supabase.ts";
import "./OwnerOrdersView.css";

function getPasswordResetRedirectUrl() {
  return `${window.location.origin}/orders/password-reset`;
}

function OwnerPasswordResetView() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const syncSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (error) {
        setAuthError(error.message);
      }

      setSession(data.session ?? null);
      setIsLoading(false);
    };

    syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession ?? null);

      if (event === "PASSWORD_RECOVERY") {
        setIsRecoveryMode(true);
        setAuthError("");
        setAuthMessage("Choose a new password to finish resetting your account.");
      } else if (event === "USER_UPDATED") {
        setIsRecoveryMode(false);
        setNewPassword("");
        setConfirmPassword("");
        setAuthError("");
        setAuthMessage("Password updated. You can sign in on the orders page.");
      } else if (event === "SIGNED_OUT") {
        setIsRecoveryMode(false);
        setNewPassword("");
        setConfirmPassword("");
      }

      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSendPasswordReset = async (event) => {
    event.preventDefault();

    if (!email.trim()) {
      setAuthError("Enter the account email first.");
      setAuthMessage("");
      return;
    }

    setIsSendingResetEmail(true);
    setAuthError("");
    setAuthMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: getPasswordResetRedirectUrl(),
    });

    if (error) {
      setAuthError(error.message);
    } else {
      setAuthMessage("Password reset email sent. Open the link in that email to choose a new password.");
    }

    setIsSendingResetEmail(false);
  };

  const handleUpdatePassword = async (event) => {
    event.preventDefault();

    if (!newPassword) {
      setAuthError("Enter a new password.");
      setAuthMessage("");
      return;
    }

    if (newPassword !== confirmPassword) {
      setAuthError("The new password and confirmation must match.");
      setAuthMessage("");
      return;
    }

    setIsUpdatingPassword(true);
    setAuthError("");
    setAuthMessage("");

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setAuthError(error.message);
    } else {
      setIsRecoveryMode(false);
      setNewPassword("");
      setConfirmPassword("");
      setAuthMessage("Password updated. You can sign in on the orders page.");
    }

    setIsUpdatingPassword(false);
  };

  if (isLoading) {
    return (
      <section className="view owner-orders-view">
        <div className="owner-orders-panel surface-card">
          <p>Loading password reset...</p>
        </div>
      </section>
    );
  }

  if (isRecoveryMode && session) {
    return (
      <section className="view owner-orders-view">
        <div className="section-heading">
          <span className="eyebrow">Password reset</span>
          <h2>Choose a new password</h2>
          <p>Set a new password for {session.user.email} to finish recovery.</p>
        </div>

        <form className="owner-orders-auth surface-card" onSubmit={handleUpdatePassword}>
          <label className="owner-orders-field">
            <span>New password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </label>

          <label className="owner-orders-field">
            <span>Confirm new password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </label>

          {authError ? <p className="owner-orders-error">{authError}</p> : null}
          {authMessage ? <p className="owner-orders-note">{authMessage}</p> : null}

          <button type="submit" className="owner-orders-primary" disabled={isUpdatingPassword}>
            {isUpdatingPassword ? "Saving new password..." : "Save new password"}
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="view owner-orders-view">
      <div className="section-heading">
        <span className="eyebrow">Password reset</span>
        <h2>Reset your password</h2>
        <p>Enter the email tied to your Supabase Auth account and we&apos;ll send you a reset link.</p>
      </div>

      <form className="owner-orders-auth surface-card" onSubmit={handleSendPasswordReset}>
        <label className="owner-orders-field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        {authError ? <p className="owner-orders-error">{authError}</p> : null}
        {authMessage ? <p className="owner-orders-note">{authMessage}</p> : null}

        <button type="submit" className="owner-orders-primary" disabled={isSendingResetEmail}>
          {isSendingResetEmail ? "Sending reset email..." : "Send reset email"}
        </button>

        <a
          href="/orders"
          className="owner-orders-link"
          onClick={(event) => handleAppLinkClick(event, "/orders")}
        >
          Back to sign in
        </a>
      </form>
    </section>
  );
}

export default OwnerPasswordResetView;
