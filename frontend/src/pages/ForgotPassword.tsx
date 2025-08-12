import React, { useState } from "react";
import { Link } from "react-router";
import ApiService from "@/services/api";
import "@/styles/Auth.css";

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [emailSent, setEmailSent] = useState<boolean>(false);

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();

    if (!e.currentTarget.checkValidity()) {
      e.currentTarget.reportValidity();
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);

    try {
      const response = await ApiService.auth.forgotPassword({
        email: email.trim(),
      });
      setMessage(response.data.message);
      setEmailSent(true);
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          "Failed to send password reset email. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setEmail(e.target.value);
    // Clear errors when user starts typing
    if (error) setError("");
    if (message) setMessage("");
  };

  if (emailSent) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-title">Check Your Email</h1>
          </div>

          <div className="auth-content">
            <div className="success-message">
              <div className="success-icon">📧</div>
              <p>{message}</p>
              <p className="email-sent-details">
                If an account with that email exists, you should receive a
                password reset link shortly. Please check your spam folder if
                you don't see it in your inbox.
              </p>
              <p className="email-sent-note">
                The reset link will expire in 1 hour for security reasons.
              </p>
            </div>

            <div className="auth-actions">
              <Link to="/login" className="auth-link">
                Back to Login
              </Link>
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
          <h1 className="auth-title">Forgot Password</h1>
          <p className="auth-subtitle">
            Enter your email address and we'll send you a link to reset your
            password.
          </p>
        </div>

        <div className="auth-content">
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {error && (
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={email}
                onChange={handleChange}
                className="form-input"
                placeholder="Enter your email address"
                required
                disabled={loading}
                autoComplete="email"
                autoFocus
              />
            </div>

            <button
              type="submit"
              className={`auth-button primary ${loading ? "loading" : ""}`}
              disabled={loading || !email.trim()}
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>

          <div className="auth-actions">
            <Link to="/login" className="auth-link">
              Back to Login
            </Link>
            <span className="auth-divider">•</span>
            <Link to="/register" className="auth-link">
              Create Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
