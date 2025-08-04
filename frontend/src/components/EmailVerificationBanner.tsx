import React, { useState, useEffect } from "react";
import ApiService from "../services/api";
import { User } from "../types";
import "../styles/EmailVerificationBanner.css";

interface EmailVerificationBannerProps {
  user: User;
}

const EmailVerificationBanner: React.FC<EmailVerificationBannerProps> = ({
  user,
}): React.ReactElement | null => {
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string>("");
  const [resendError, setResendError] = useState<string>("");
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    // Set up countdown timer if there's a rate limit error
    if (timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            setResendError("");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
    return undefined;
  }, [timeRemaining]);

  const handleResendVerification = async () => {
    setIsResending(true);
    setResendMessage("");
    setResendError("");

    try {
      const response = await ApiService.auth.resendVerification();
      setResendMessage(
        response.data.message || "Verification email sent successfully!"
      );

      // Clear success message after 5 seconds
      setTimeout(() => setResendMessage(""), 5000);
    } catch (error: any) {
      console.error("Failed to resend verification email:", error);

      if (error.response?.status === 429) {
        // Rate limit error - extract time from error message
        const errorMessage = error.response.data.error || "";
        const minutesMatch = errorMessage.match(/(\d+) minutes?/);

        if (minutesMatch) {
          const minutes = parseInt(minutesMatch[1]);
          setTimeRemaining(minutes * 60);
        }

        setResendError(errorMessage);
      } else {
        setResendError(
          error.response?.data?.error || "Failed to resend verification email"
        );
      }
    } finally {
      setIsResending(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Don't show banner if user is verified or uses Google OAuth
  if (user.email_verified || user.auth_provider === "google") {
    return null;
  }

  return (
    <div className="email-verification-banner">
      <div className="verification-banner-content">
        <div className="verification-icon">📧</div>
        <div className="verification-text">
          <h4>Email Verification Required</h4>
          <p>
            Please check your email ({user.email}) and click the verification
            link to complete your account setup.
          </p>
        </div>
        <div className="verification-actions">
          <button
            onClick={handleResendVerification}
            disabled={isResending || timeRemaining > 0}
            className="resend-button"
          >
            {isResending ? (
              <>
                <span className="spinner"></span>
                Sending...
              </>
            ) : timeRemaining > 0 ? (
              `Resend in ${formatTime(timeRemaining)}`
            ) : (
              "Resend Email"
            )}
          </button>
        </div>
      </div>

      {resendMessage && (
        <div className="verification-message success">✅ {resendMessage}</div>
      )}

      {resendError && (
        <div className="verification-message error">⚠️ {resendError}</div>
      )}
    </div>
  );
};

export default EmailVerificationBanner;
