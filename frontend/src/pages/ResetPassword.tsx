import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import ApiService from "@/services/api";
import "@/styles/Auth.css";

/**
 * Type guard and utility function to safely extract error messages from unknown error types
 */
function extractErrorMessage(err: unknown): string {
  const e = err as any;
  // Axios-like error with response.data.error
  if (typeof e?.response?.data?.error === "string") {
    return e.response.data.error;
  }
  // Standard Error
  if (e instanceof Error && typeof e.message === "string") {
    return e.message;
  }
  // Object with a message property
  if (typeof e?.message === "string") {
    return e.message;
  }
  // Fallback
  return "Failed to reset password. Please try again or request a new reset link.";
}

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [token, setToken] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState<boolean>(false);

  // Extract token from URL params on component mount
  useEffect(() => {
    const urlToken = searchParams.get("token");
    if (urlToken) {
      setToken(urlToken);
    } else {
      setError("No reset token provided. Please use the link from your email.");
    }
  }, [searchParams]);

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();

    if (!e.currentTarget.checkValidity()) {
      e.currentTarget.reportValidity();
      return;
    }

    // Validate passwords match
    if (formData.newPassword !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!token) {
      setError("Invalid reset token. Please request a new password reset.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await ApiService.auth.resetPassword({
        token,
        new_password: formData.newPassword,
      });
      setSuccess(true);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value,
    }));

    // Clear errors when user starts typing
    if (error) setError("");
  };

  const getPasswordStrengthClass = (password: string): string => {
    if (!password) return "";

    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[~!@#$%^&*()_\-+={}[\]|\\:;"'<,>.?/`]/.test(password);
    const isLongEnough = password.length >= 8;

    const score = [
      hasLower,
      hasUpper,
      hasNumber,
      hasSpecial,
      isLongEnough,
    ].filter(Boolean).length;

    if (score < 3) return "weak";
    if (score < 5) return "medium";
    return "strong";
  };

  const passwordStrength = getPasswordStrengthClass(formData.newPassword);

  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-title">Password Reset Successful</h1>
          </div>

          <div className="auth-content">
            <div className="success-message">
              <div className="success-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p>Your password has been successfully reset!</p>
              <p className="success-details">
                You can now log in with your new password.
              </p>
            </div>

            <div className="auth-actions">
              <button
                onClick={() => navigate("/login")}
                className="auth-button primary"
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Reset Password</h1>
          <p className="auth-subtitle">Enter your new password below.</p>
        </div>

        <div className="auth-content">
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {error && (
              <div className="error-message">
                <span className="error-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </span>
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="newPassword" className="form-label">
                New Password
              </label>
              <div className="password-input-container">
                <input
                  type={showPassword ? "text" : "password"}
                  id="newPassword"
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Enter new password"
                  required
                  disabled={loading}
                  autoComplete="new-password"
                  minLength={8}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <svg
                      className="icon-eye"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    <svg
                      className="icon-eye-off"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  )}
                </button>
              </div>
              {formData.newPassword && (
                <div className={`password-strength ${passwordStrength}`}>
                  Password strength: <strong>{passwordStrength}</strong>
                </div>
              )}
              <div className="password-requirements">
                <small>
                  Password must be at least 8 characters and contain uppercase,
                  lowercase, number, and special character.
                </small>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">
                Confirm New Password
              </label>
              <div className="password-input-container">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Confirm new password"
                  required
                  disabled={loading}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg
                      className="icon-eye"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    <svg
                      className="icon-eye-off"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  )}
                </button>
              </div>
              {formData.confirmPassword &&
                formData.newPassword !== formData.confirmPassword && (
                  <div className="field-error">Passwords do not match</div>
                )}
            </div>

            <button
              type="submit"
              className={`auth-button primary ${loading ? "loading" : ""}`}
              disabled={
                loading ||
                !formData.newPassword ||
                !formData.confirmPassword ||
                formData.newPassword !== formData.confirmPassword ||
                !token ||
                getPasswordStrengthClass(formData.newPassword) !== "strong"
              }
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>

          <div className="auth-actions">
            <Link to="/forgot-password" className="auth-link">
              Request New Reset Link
            </Link>
            <span className="auth-divider">•</span>
            <Link to="/login" className="auth-link">
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
