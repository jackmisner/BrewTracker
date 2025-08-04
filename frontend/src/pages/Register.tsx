import React, { useState, useEffect, useCallback } from "react";
import ApiService from "../services/api";
import { User } from "../types";
import GoogleSignInButton from "../components/GoogleSignInButton";
import "../styles/Auth.css";

interface RegisterProps {
  onLogin: (user: User, token: string) => void;
}

interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface FieldErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

interface UsernameValidationState {
  isValidating: boolean;
  isValid: boolean | null;
  suggestions: string[];
}

const Register: React.FC<RegisterProps> = ({ onLogin }) => {
  const [formData, setFormData] = useState<RegisterFormData>({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [usernameValidation, setUsernameValidation] =
    useState<UsernameValidationState>({
      isValidating: false,
      isValid: null,
      suggestions: [],
    });
  const [registrationSuccess, setRegistrationSuccess] =
    useState<boolean>(false);
  const [verificationEmailSent, setVerificationEmailSent] =
    useState<boolean>(false);

  // Debounced username validation
  const validateUsernameAsync = useCallback(
    async (username: string): Promise<void> => {
      if (!username || username.length < 3) {
        setUsernameValidation({
          isValidating: false,
          isValid: null,
          suggestions: [],
        });
        return;
      }

      setUsernameValidation(prev => ({ ...prev, isValidating: true }));

      try {
        const response = await ApiService.auth.validateUsername({ username });
        const { valid, error, suggestions = [] } = response?.data || {};

        setUsernameValidation({
          isValidating: false,
          isValid: valid,
          suggestions,
        });

        // Update field errors based on validation result
        setFieldErrors(prevErrors => {
          const errors = { ...prevErrors };
          if (!valid && error) {
            errors.username = error;
          } else {
            delete errors.username;
          }
          return errors;
        });
      } catch (err) {
        setUsernameValidation({
          isValidating: false,
          isValid: false,
          suggestions: [],
        });
        console.error("Username validation failed:", err);
      }
    },
    [] // No dependencies needed since we use functional updates
  );

  // Debounce username validation
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (formData.username && formData.username.length >= 3) {
        validateUsernameAsync(formData.username);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData.username, validateUsernameAsync]);

  const validateField = (name: keyof RegisterFormData, value: string): void => {
    const errors = { ...fieldErrors };

    switch (name) {
      case "username":
        if (value.length < 3) {
          errors.username = "Username must be at least 3 characters";
          setUsernameValidation({
            isValidating: false,
            isValid: null,
            suggestions: [],
          });
        } else {
          // Don't clear username errors here - let async validation handle it
          // Async validation will run via useEffect
        }
        break;
      case "email":
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors.email = "Please enter a valid email address";
        } else {
          delete errors.email;
        }
        break;
      case "password":
        // Clear any existing password error
        delete errors.password;

        if (value.length < 8) {
          errors.password = "Password must be at least 8 characters long";
        } else if (!/[a-z]/.test(value)) {
          errors.password =
            "Password must contain at least one lowercase letter";
        } else if (!/[A-Z]/.test(value)) {
          errors.password =
            "Password must contain at least one uppercase letter";
        } else if (!/\d/.test(value)) {
          errors.password = "Password must contain at least one number";
        } else if (!/[~!@#$%^&*()_\-+={}|\\:;"'<,>.?/]/.test(value)) {
          errors.password =
            "Password must contain at least one special character";
        }
        // If password is valid, check confirm password
        // Re-validate confirm password if it exists
        if (formData.confirmPassword && value !== formData.confirmPassword) {
          errors.confirmPassword = "Passwords do not match";
        } else if (
          formData.confirmPassword &&
          value === formData.confirmPassword
        ) {
          delete errors.confirmPassword;
        }
        break;
      case "confirmPassword":
        if (value !== formData.password) {
          errors.confirmPassword = "Passwords do not match";
        } else {
          delete errors.confirmPassword;
        }
        break;
      default:
        break;
    }

    setFieldErrors(errors);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value,
    }));

    // Validate field on change
    validateField(name as keyof RegisterFormData, value);
  };

  const getInputClassName = (fieldName: keyof RegisterFormData): string => {
    let className = "auth-input";

    if (fieldName === "username") {
      if (usernameValidation.isValidating) {
        className += " validating";
      } else if (fieldErrors.username) {
        className += " invalid";
      } else if (usernameValidation.isValid && formData.username) {
        className += " valid";
      }
    } else {
      if (fieldErrors[fieldName]) {
        className += " invalid";
      } else if (formData[fieldName] && !fieldErrors[fieldName]) {
        className += " valid";
      }
    }

    return className;
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    if (!e.currentTarget.checkValidity()) {
      e.currentTarget.reportValidity();
      return;
    }

    setError("");

    // Validate all fields
    Object.keys(formData).forEach(key => {
      validateField(
        key as keyof RegisterFormData,
        formData[key as keyof RegisterFormData]
      );
    });

    // Check if there are any validation errors
    if (Object.keys(fieldErrors).length > 0) {
      setError("Please fix the errors below");
      return;
    }

    // Final password match check
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      // Send registration data to API
      const registerResponse = await ApiService.auth.register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });

      // Registration successful - show verification message instead of auto-login
      setRegistrationSuccess(true);
      setVerificationEmailSent(
        registerResponse.data.verification_email_sent || false
      );
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          "Failed to register. Please check your information."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (token: string): Promise<void> => {
    setError("");
    setLoading(true);

    try {
      const response = await ApiService.auth.googleAuth({ token });
      onLogin(response.data.user, response.data.access_token);
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          "Failed to sign up with Google. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = (error: string): void => {
    setError(error);
  };

  return (
    <div data-testid="auth-wrapper" className="auth-wrapper">
      <div className="auth-split-layout">
        {/* Welcome Section */}
        <div className="auth-welcome-section">
          <div className="auth-welcome-content">
            <h1 className="auth-welcome-title">Start Your Brewing Journey</h1>
            <p className="auth-welcome-subtitle">
              Join thousands of brewers perfecting their craft
            </p>
            <ul className="auth-features-list">
              <li className="auth-feature-item">
                <span className="auth-feature-icon">🌟</span>
                Free forever - no hidden costs
              </li>
              <li className="auth-feature-item">
                <span className="auth-feature-icon">🔬</span>
                Advanced brewing calculations
              </li>
              <li className="auth-feature-item">
                <span className="auth-feature-icon">📚</span>
                BJCP style guidelines built-in
              </li>
              <li className="auth-feature-item">
                <span className="auth-feature-icon">👥</span>
                Share recipes with the community
              </li>
              <li className="auth-feature-item">
                <span className="auth-feature-icon">🏆</span>
                Track your brewing achievements
              </li>
            </ul>
          </div>
        </div>

        {/* Form Section */}
        <div className="auth-form-section">
          <div data-testid="auth-container" className="auth-container">
            {registrationSuccess ? (
              // Success message
              <div className="registration-success">
                <div className="auth-icon success">✅</div>
                <h2 className="auth-title">Account Created Successfully!</h2>
                {verificationEmailSent ? (
                  <>
                    <p className="auth-subtitle">
                      We've sent a verification email to{" "}
                      <strong>{formData.email}</strong>
                    </p>
                    <div className="verification-instructions">
                      <p>
                        Please check your email and click the verification link
                        to activate your account.
                      </p>
                      <p className="verification-note">
                        <strong>Important:</strong> You'll need to verify your
                        email before you can access all features.
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="auth-subtitle">
                    Your account has been created, but we couldn't send the
                    verification email. Please contact support if you need
                    assistance.
                  </p>
                )}

                <div className="auth-actions">
                  <a href="/login" className="auth-button primary">
                    Continue to Login
                  </a>
                  <button
                    onClick={() => setRegistrationSuccess(false)}
                    className="auth-button secondary"
                  >
                    Back to Registration
                  </button>
                </div>
              </div>
            ) : (
              // Registration form
              <>
                <h2 data-testid="auth-title" className="auth-title">
                  Create Account
                </h2>
                <p data-testid="auth-subtitle" className="auth-subtitle">
                  Join the brewing community
                </p>

                {error && <div className="auth-error">{error}</div>}

                <form onSubmit={handleSubmit} className="auth-form">
                  <div className="auth-form-group">
                    <label className="auth-label" htmlFor="username">
                      Username
                    </label>
                    <input
                      type="text"
                      id="username"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      className={getInputClassName("username")}
                      placeholder="Choose a username"
                      required
                    />
                    {usernameValidation.isValidating && (
                      <div className="auth-field-info">
                        🔄 Checking username availability...
                      </div>
                    )}
                    {fieldErrors.username &&
                      !usernameValidation.isValidating && (
                        <div
                          data-testid="auth-field-error"
                          className="auth-field-error"
                        >
                          {fieldErrors.username}
                        </div>
                      )}
                    {usernameValidation.isValid &&
                      formData.username &&
                      !usernameValidation.isValidating && (
                        <div className="auth-field-success">
                          ✅ Username is available
                        </div>
                      )}
                    {usernameValidation.suggestions.length > 0 &&
                      !usernameValidation.isValidating && (
                        <div className="auth-suggestions">
                          <div className="auth-suggestions-title">
                            Suggestions:
                          </div>
                          <div className="auth-suggestions-list">
                            {usernameValidation.suggestions.map(
                              (suggestion, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  className="auth-suggestion-button"
                                  onClick={() => {
                                    setFormData(prev => ({
                                      ...prev,
                                      username: suggestion,
                                    }));
                                    setFieldErrors(prev => ({
                                      ...prev,
                                      username: undefined,
                                    }));
                                  }}
                                >
                                  {suggestion}
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      )}
                  </div>

                  <div className="auth-form-group">
                    <label className="auth-label" htmlFor="email">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={getInputClassName("email")}
                      placeholder="Enter your email"
                      required
                    />
                    {fieldErrors.email && (
                      <div className="auth-field-error">
                        {fieldErrors.email}
                      </div>
                    )}
                  </div>

                  <div className="auth-form-group">
                    <label className="auth-label" htmlFor="password">
                      Password
                    </label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className={getInputClassName("password")}
                      placeholder="Create a password"
                      required
                      minLength={8}
                    />
                    {fieldErrors.password && (
                      <div className="auth-field-error">
                        {fieldErrors.password}
                      </div>
                    )}

                    {/* Password requirements with real-time validation */}
                    {formData.password && (
                      <div className="auth-requirements">
                        <div className="auth-requirements-title">
                          Password Requirements:
                        </div>
                        <ul className="auth-requirements-list">
                          <li
                            className={
                              formData.password.length >= 8
                                ? "requirement-met"
                                : "requirement-unmet"
                            }
                          >
                            ✓ At least 8 characters long
                          </li>
                          <li
                            className={
                              /[a-z]/.test(formData.password)
                                ? "requirement-met"
                                : "requirement-unmet"
                            }
                          >
                            ✓ Contains at least one lowercase letter
                          </li>
                          <li
                            className={
                              /[A-Z]/.test(formData.password)
                                ? "requirement-met"
                                : "requirement-unmet"
                            }
                          >
                            ✓ Contains at least one uppercase letter
                          </li>
                          <li
                            className={
                              /\d/.test(formData.password)
                                ? "requirement-met"
                                : "requirement-unmet"
                            }
                          >
                            ✓ Contains at least one number
                          </li>
                          <li
                            className={
                              /[~!@#$%^&*()_\-+={}|\\:;"'<,>.?/]/.test(
                                formData.password
                              )
                                ? "requirement-met"
                                : "requirement-unmet"
                            }
                          >
                            ✓ Contains at least one special character
                            (~!@#$%^&*()_-+={"{"}
                            {"}"}
                            {"]"}|\\:;"'&lt;,&gt;.?/)
                          </li>
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="auth-form-group">
                    <label className="auth-label" htmlFor="confirmPassword">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      id="confirmPassword"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className={getInputClassName("confirmPassword")}
                      placeholder="Confirm your password"
                      required
                    />
                    {fieldErrors.confirmPassword && (
                      <div className="auth-field-error">
                        {fieldErrors.confirmPassword}
                      </div>
                    )}
                    {formData.confirmPassword &&
                      !fieldErrors.confirmPassword &&
                      formData.password === formData.confirmPassword && (
                        <div className="auth-field-success">
                          Passwords match
                        </div>
                      )}
                  </div>

                  <button
                    type="submit"
                    className={`auth-submit-button ${loading ? "loading" : ""}`}
                    disabled={loading || Object.keys(fieldErrors).length > 0}
                  >
                    {loading ? "" : "Create Account"}
                  </button>
                </form>

                <div className="auth-divider">or</div>

                <GoogleSignInButton
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  text="Sign up with Google"
                  disabled={loading}
                />

                <div className="auth-nav">
                  <p className="auth-nav-text">Already have an account?</p>
                  <a href="/login" className="auth-nav-link">
                    Sign in here
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
