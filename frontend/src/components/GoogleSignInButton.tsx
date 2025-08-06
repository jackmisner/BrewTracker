import React, { useState, useEffect, useCallback } from "react";
import "@/styles/GoogleSignInButton.css";

interface GoogleSignInButtonProps {
  onSuccess: (token: string) => void;
  onError: (error: string) => void;
  text?: string;
  disabled?: boolean;
}

declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onSuccess,
  onError,
  text = "Sign in with Google",
  disabled = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  const handleCredentialResponse = useCallback(
    (response: any) => {
      if (response.credential) {
        onSuccess(response.credential);
      } else {
        onError("No credential received from Google");
      }
    },
    [onSuccess, onError]
  );

  useEffect(() => {
    // Load Google Identity Services script
    const loadGoogleScript = () => {
      if (window.google) {
        setIsGoogleLoaded(true);
        return;
      }

      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.google) {
          setIsGoogleLoaded(true);
        }
      };
      script.onerror = () => {
        onError("Failed to load Google Sign-In");
      };
      document.head.appendChild(script);
    };

    loadGoogleScript();
  }, [onError]);

  useEffect(() => {
    if (isGoogleLoaded && window.google) {
      // Initialize Google Sign-In
      try {
        window.google.accounts.id.initialize({
          client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          use_fedcm_for_prompt: true,
        });
      } catch (error) {
        console.error("Failed to initialize Google Sign-In:", error);
        onError("Failed to initialize Google Sign-In");
      }
    }
  }, [isGoogleLoaded, handleCredentialResponse, onError]);

  const handleSignIn = useCallback(async () => {
    if (!isGoogleLoaded || !window.google) {
      onError("Google Sign-In is not loaded");
      return;
    }

    setIsLoading(true);

    try {
      // Use the One Tap flow with FedCM enabled
      window.google.accounts.id.prompt();

      // Set a timeout to handle cases where prompt doesn't trigger callback
      setTimeout(() => {
        setIsLoading(false);
      }, 5000);
    } catch (error) {
      console.error("Google Sign-In error:", error);
      onError("Google Sign-In failed");
      setIsLoading(false);
    }
  }, [isGoogleLoaded, onError]);

  return (
    <div className="google-signin-container">
      <button
        type="button"
        className={`google-signin-button ${isLoading ? "loading" : ""}`}
        onClick={handleSignIn}
        disabled={disabled || isLoading || !isGoogleLoaded}
      >
        <div className="google-signin-button-content">
          {isLoading ? (
            <div className="google-signin-spinner"></div>
          ) : (
            <svg
              className="google-icon"
              viewBox="0 0 24 24"
              width="20"
              height="20"
            >
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          <span className="google-signin-text">
            {isLoading ? "Signing in..." : text}
          </span>
        </div>
      </button>
    </div>
  );
};

export default GoogleSignInButton;
