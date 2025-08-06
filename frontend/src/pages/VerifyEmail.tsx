import React, {
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
} from "react";
import { useSearchParams, useNavigate, Link } from "react-router";
import ApiService from "@/services/api";
import { AuthContext } from "@/App";
import "@/styles/Auth.css";

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleLogin } = useContext(AuthContext);
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState<string>("");
  const [isResending, setIsResending] = useState(false);
  const verificationAttempted = useRef(false);

  const token = searchParams.get("token");

  const verifyEmail = useCallback(
    async (verificationToken: string) => {
      try {
        const response = await ApiService.auth.verifyEmail({
          token: verificationToken,
        });

        setStatus("success");
        setMessage(response.data.message || "Email verified successfully!");

        // Check if auto-login data is provided
        if (response.data.access_token && response.data.user) {
          // Auto-login the user
          handleLogin(response.data.user, response.data.access_token);

          // Redirect to dashboard after auto-login
          setTimeout(() => {
            navigate("/", {
              state: { message: "Email verified! Welcome to BrewTracker!" },
            });
          }, 2000);
        } else {
          // Fallback to login page
          setTimeout(() => {
            navigate("/login", {
              state: { message: "Email verified! Please log in to continue." },
            });
          }, 3000);
        }
      } catch (error: any) {
        setStatus("error");

        if (error.response?.data?.error) {
          setMessage(error.response.data.error);
        } else {
          setMessage("Failed to verify email. Please try again.");
        }
      }
    },
    [handleLogin, navigate]
  );

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token provided");
      return;
    }

    // Prevent double execution (React StrictMode, etc.)
    if (verificationAttempted.current) {
      return;
    }
    verificationAttempted.current = true;

    verifyEmail(token);
  }, [token, verifyEmail]);

  const handleResendVerification = async () => {
    setIsResending(true);

    try {
      // Note: This requires the user to be logged in
      // In a real app, you might want a different endpoint that takes email instead
      await ApiService.auth.resendVerification();
      setMessage("New verification email sent! Please check your inbox.");
    } catch (error: any) {
      console.error("Failed to resend verification:", error);
      if (error.response?.status === 401) {
        setMessage("Please log in to resend verification email.");
      } else {
        setMessage(
          error.response?.data?.error || "Failed to resend verification email"
        );
      }
    } finally {
      setIsResending(false);
    }
  };

  const renderContent = () => {
    switch (status) {
      case "loading":
        return (
          <>
            <div className="auth-icon">
              <div className="spinner-large"></div>
            </div>
            <h2>Verifying Your Email</h2>
            <p>Please wait while we verify your email address...</p>
          </>
        );

      case "success":
        return (
          <>
            <div className="auth-icon success">✅</div>
            <h2>Email Verified Successfully!</h2>
            <p>{message}</p>
            <p className="redirect-message">
              Logging you in and redirecting to dashboard...
            </p>
            <div className="auth-actions">
              <Link to="/" className="auth-button primary">
                Continue to Dashboard
              </Link>
            </div>
          </>
        );

      case "error":
        return (
          <>
            <div className="auth-icon error">❌</div>
            <h2>Verification Failed</h2>
            <p className="error-message">{message}</p>

            {message.includes("expired") && (
              <div className="verification-expired">
                <p>
                  Your verification link has expired. You can request a new one
                  below:
                </p>
                <button
                  onClick={handleResendVerification}
                  disabled={isResending}
                  className="auth-button secondary"
                >
                  {isResending ? (
                    <>
                      <span className="spinner"></span>
                      Sending...
                    </>
                  ) : (
                    "Send New Verification Email"
                  )}
                </button>
                <p className="auth-note">
                  Note: You need to be logged in to resend verification emails.
                </p>
              </div>
            )}

            <div className="auth-actions">
              <Link to="/login" className="auth-button primary">
                Back to Login
              </Link>
              <Link to="/register" className="auth-button secondary">
                Create New Account
              </Link>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>🍺 BrewTracker</h1>
        </div>

        <div className="auth-content">{renderContent()}</div>

        <div className="auth-footer">
          <p>
            Need help? <Link to="/support">Contact Support</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
