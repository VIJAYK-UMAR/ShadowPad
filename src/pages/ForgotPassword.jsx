
import { useState } from "react";
import { Link } from "react-router-dom";
import { LockKeyhole, Mail } from "lucide-react";
import { supabase } from "../lib/supabase";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    try {
      setLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (error) throw error;

      setSuccess(true);
    } catch (err) {
      setError(err.message || "Could not send reset email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand-icon">
          <LockKeyhole size={28} />
        </div>

        <h1>Forgot password?</h1>

        <p className="subtitle">
          Enter your registered email address. We'll send you a
          link to reset your account password.
        </p>

        <form onSubmit={handleSubmit}>
          <label>Email address</label>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          {error && <p className="error-message">{error}</p>}

          {success && (
            <p className="success-message">
              If the account exists, a password reset email has been
              sent. Check your inbox and spam folder.
            </p>
          )}

          <button
            className="primary-button"
            type="submit"
            disabled={loading}
          >
            <Mail size={17} />
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <p className="auth-footer">
          <Link to="/">Back to login</Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPassword;
