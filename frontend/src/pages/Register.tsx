import React, { useState } from "react";
import ApiService from "../services/api";
import { User } from "../types";
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

  const validateField = (name: keyof RegisterFormData, value: string): void => {
    const errors = { ...fieldErrors };

    switch (name) {
      case "username":
        if (value.length < 3) {
          errors.username = "Username must be at least 3 characters";
        } else {
          delete errors.username;
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
        if (value.length < 6) {
          errors.password = "Password must be at least 6 characters";
        } else {
          delete errors.password;
        }
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
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));

    // Validate field on change
    validateField(name as keyof RegisterFormData, value);
  };

  const getInputClassName = (fieldName: keyof RegisterFormData): string => {
    let className = "auth-input";
    if (fieldErrors[fieldName]) {
      className += " invalid";
    } else if (formData[fieldName] && !fieldErrors[fieldName]) {
      className += " valid";
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
    Object.keys(formData).forEach((key) => {
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
      await ApiService.auth.register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });

      // After successful registration, log the user in
      const loginResponse = await ApiService.auth.login({
        username: formData.username,
        password: formData.password,
      });

      // Update app state with user info and token
      onLogin(loginResponse.data.user, loginResponse.data.access_token);
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          "Failed to register. Please check your information."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="auth-wrapper" className="auth-wrapper">
      <div data-testid="auth-container" className="auth-container">
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
            {fieldErrors.username && (
              <div data-testid="auth-field-error" className="auth-field-error">
                {fieldErrors.username}
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
              <div className="auth-field-error">{fieldErrors.email}</div>
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
              minLength={6}
            />
            {fieldErrors.password && (
              <div className="auth-field-error">{fieldErrors.password}</div>
            )}

            {/* Password requirements */}
            {formData.password && !fieldErrors.password && (
              <div className="auth-requirements">
                <div className="auth-requirements-title">
                  Password Requirements:
                </div>
                <ul className="auth-requirements-list">
                  <li>At least 6 characters long</li>
                  <li>Contains letters and numbers (recommended)</li>
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
                <div className="auth-field-success">Passwords match</div>
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

        <div className="auth-nav">
          <p className="auth-nav-text">Already have an account?</p>
          <a href="/login" className="auth-nav-link">
            Sign in here
          </a>
        </div>
      </div>
    </div>
  );
};

export default Register;
