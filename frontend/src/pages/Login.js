import React, { useState } from "react";
import ApiService from "../services/api";
import "../styles/Auth.css";

function Login({ onLogin }) {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await ApiService.auth.login(formData);
      onLogin(response.data.user, response.data.access_token);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Failed to login. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-container">
        <h2 className="auth-title">Welcome Back</h2>
        <p className="auth-subtitle">Sign in to your brewing account</p>

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
  );
}

export default Login;
