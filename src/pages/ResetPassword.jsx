
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LockKeyhole, Eye, EyeOff } from "lucide-react";
import { supabase } from "../lib/supabase";

function ResetPassword() {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [checkingSession, setCheckingSession] = useState(true);
  const [validSession, setValidSession] = useState(false);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      setValidSession(Boolean(data.session) && !error);
      setCheckingSession(false);
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "PASSWORD_RECOVERY") {
        setValidSession(Boolean(session));
        setCheckingSession(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      setSuccess(true);
    } catch (err) {
      setError(err.message || "Password reset failed.");
    } finally {
      setLoading(false);
    }
  }

  async function finishReset() {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  }

  if (checkingSession) {
    return (
      <div className="loading-screen">
        Checking password reset link...
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand-icon">
          <LockKeyhole size={28} />
        </div>

        {success ? (
          <>
            <h1>Password updated!</h1>

            <p className="success-message">
              Your account password has been changed successfully.
              You can now sign in with your new password.
            </p>

            <button
              className="primary-button"
              onClick={finishReset}
              type="button"
            >
              Continue to login
            </button>
          </>
        ) : !validSession ? (
          <>
            <h1>Invalid reset link</h1>

            <p className="error-message">
              This reset link is invalid or expired. Request a new
              password reset email.
            </p>

            <Link className="primary-button reset-link-button" to="/forgot-password">
              Request another link
            </Link>
          </>
        ) : (
          <>
            <h1>Set new password</h1>

            <p className="subtitle">
              Create a new password for your account.
            </p>

            <form onSubmit={handleSubmit}>
              <label>New password</label>

              <div className="password-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                  required
                />

                <button
                  type="button"
                  className="eye-button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <label>Confirm new password</label>

              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
                required
              />

              {error && <p className="error-message">{error}</p>}

              <button
                className="primary-button"
                type="submit"
                disabled={loading}
              >
                {loading ? "Updating..." : "Update password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default ResetPassword;
