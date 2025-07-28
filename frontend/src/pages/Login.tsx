import React, { useState } from "react";
import ApiService from "../services/api";
import { User } from "../types";
import "../styles/Auth.css";

interface LoginProps {
  onLogin: (user: User, token: string) => void;
}

interface LoginFormData {
  username: string;
  password: string;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [formData, setFormData] = useState<LoginFormData>({
    username: "",
    password: "",
  });
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
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
    setLoading(true);

    try {
      const response = await ApiService.auth.login(formData);
      onLogin(response.data.user, response.data.access_token);
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          "Failed to login. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="auth-wrapper" className="auth-wrapper">
      <div className="auth-split-layout">
        {/* Welcome Section */}
        <div className="auth-welcome-section">
          <div className="auth-welcome-content">
            <h1 className="auth-welcome-title">Welcome to BrewTracker</h1>
            <p className="auth-welcome-subtitle">
              Your complete homebrewing companion
            </p>
            <ul className="auth-features-list">
              <li className="auth-feature-item">
                <span className="auth-feature-icon">🍺</span>
                Create and manage brewing recipes
              </li>
              <li className="auth-feature-item">
                <span className="auth-feature-icon">📊</span>
                Track fermentation progress
              </li>
              <li className="auth-feature-item">
                <span className="auth-feature-icon">🎯</span>
                Style analysis and guidance
              </li>
              <li className="auth-feature-item">
                <span className="auth-feature-icon">🤖</span>
                AI-powered recipe optimization
              </li>
              <li className="auth-feature-item">
                <span className="auth-feature-icon">📱</span>
                Import/export BeerXML recipes
              </li>
            </ul>
          </div>
        </div>

        {/* Form Section */}
        <div className="auth-form-section">
          <div data-testid="auth-container" className="auth-container">
            <h2 data-testid="auth-title" className="auth-title">
              Welcome Back
            </h2>
            <p data-testid="auth-subtitle" className="auth-subtitle">
              Sign in to your brewing account
            </p>

            {error && <div className="auth-error">{error}</div>}

            <form
              onSubmit={handleSubmit}
              data-testid="auth-form"
              className="auth-form"
            >
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
                  className="auth-input"
                  placeholder="Enter your username"
                  required
                />
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
                  className="auth-input"
                  placeholder="Enter your password"
                  required
                />
              </div>

              <button
                type="submit"
                className={`auth-submit-button ${loading ? "loading" : ""}`}
                disabled={loading}
              >
                {loading ? "" : "Sign In"}
              </button>
            </form>

            <div className="auth-nav">
              <p className="auth-nav-text">Don't have an account?</p>
              <a href="/register" className="auth-nav-link">
                Create an account
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
