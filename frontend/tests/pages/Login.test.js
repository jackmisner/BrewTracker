import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Login from "../../src/pages/Login";
import ApiService from "../../src/services/api";

// Mock the API service
jest.mock("../../src/services/api");

describe("Login", () => {
  const mockOnLogin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders login form", () => {
    render(<Login onLogin={mockOnLogin} />);

    expect(screen.getByText("Welcome Back")).toBeInTheDocument();
    expect(
      screen.getByText("Sign in to your brewing account")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  });

  test("renders navigation link to register", () => {
    render(<Login onLogin={mockOnLogin} />);

    expect(screen.getByText("Don't have an account?")).toBeInTheDocument();
    expect(screen.getByText("Create an account")).toBeInTheDocument();

    const registerLink = screen.getByText("Create an account");
    expect(registerLink).toHaveAttribute("href", "/register");
  });

  test("handles form input changes", async () => {
    const user = userEvent.setup();
    render(<Login onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText("Username");
    const passwordInput = screen.getByLabelText("Password");

    await user.type(usernameInput, "testuser");
    await user.type(passwordInput, "testpassword");

    expect(usernameInput.value).toBe("testuser");
    expect(passwordInput.value).toBe("testpassword");
  });

  test("requires username and password fields", async () => {
    const user = userEvent.setup();
    render(<Login onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText("Username");
    const passwordInput = screen.getByLabelText("Password");

    expect(usernameInput).toBeRequired();
    expect(passwordInput).toBeRequired();
  });

  test("successful login calls onLogin with user data", async () => {
    const user = userEvent.setup();

    const mockLoginResponse = {
      data: {
        user: {
          user_id: "123",
          username: "testuser",
          email: "test@example.com",
        },
        access_token: "mock-jwt-token",
      },
    };

    ApiService.auth.login.mockResolvedValue(mockLoginResponse);

    render(<Login onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText("Username");
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign In" });

    await user.type(usernameInput, "testuser");
    await user.type(passwordInput, "testpassword");
    await user.click(submitButton);

    await waitFor(() => {
      expect(ApiService.auth.login).toHaveBeenCalledWith({
        username: "testuser",
        password: "testpassword",
      });
    });

    expect(mockOnLogin).toHaveBeenCalledWith(
      mockLoginResponse.data.user,
      mockLoginResponse.data.access_token
    );
  });

  test("handles login form submission via enter key", async () => {
    const user = userEvent.setup();

    const mockLoginResponse = {
      data: {
        user: { username: "testuser" },
        access_token: "token",
      },
    };

    ApiService.auth.login.mockResolvedValue(mockLoginResponse);

    render(<Login onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText("Username");
    const passwordInput = screen.getByLabelText("Password");

    await user.type(usernameInput, "testuser");
    await user.type(passwordInput, "testpassword");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(ApiService.auth.login).toHaveBeenCalled();
    });
  });

  test("shows loading state during login", async () => {
    const user = userEvent.setup();

    // Mock a delayed login response
    ApiService.auth.login.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    render(<Login onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText("Username");
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign In" });

    await user.type(usernameInput, "testuser");
    await user.type(passwordInput, "testpassword");
    await user.click(submitButton);

    // Check loading state
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveClass("loading");

    // Button text should be empty during loading (spinner shown instead)
    expect(submitButton).toHaveTextContent("");

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  test("displays error message on login failure", async () => {
    const user = userEvent.setup();

    const mockError = {
      response: {
        data: {
          error: "Invalid username or password",
        },
      },
    };

    ApiService.auth.login.mockRejectedValue(mockError);

    render(<Login onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText("Username");
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign In" });

    await user.type(usernameInput, "wronguser");
    await user.type(passwordInput, "wrongpassword");
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Invalid username or password")
      ).toBeInTheDocument();
    });

    expect(mockOnLogin).not.toHaveBeenCalled();
  });

  test("displays generic error message when no specific error provided", async () => {
    const user = userEvent.setup();

    ApiService.auth.login.mockRejectedValue(new Error("Network error"));

    render(<Login onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText("Username");
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign In" });

    await user.type(usernameInput, "testuser");
    await user.type(passwordInput, "testpassword");
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to login. Please check your credentials.")
      ).toBeInTheDocument();
    });
  });

  test("clears error message on new form submission", async () => {
    const user = userEvent.setup();

    // First, cause an error
    ApiService.auth.login.mockRejectedValueOnce(new Error("Login failed"));

    render(<Login onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText("Username");
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign In" });

    await user.type(usernameInput, "testuser");
    await user.type(passwordInput, "wrongpassword");
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to login. Please check your credentials.")
      ).toBeInTheDocument();
    });

    // Now mock a successful login
    ApiService.auth.login.mockResolvedValue({
      data: {
        user: { username: "testuser" },
        access_token: "token",
      },
    });

    // Try again with correct password
    await user.clear(passwordInput);
    await user.type(passwordInput, "correctpassword");
    await user.click(submitButton);

    // Error message should be cleared
    await waitFor(() => {
      expect(
        screen.queryByText("Failed to login. Please check your credentials.")
      ).not.toBeInTheDocument();
    });
  });

  test("form inputs have correct placeholders", () => {
    render(<Login onLogin={mockOnLogin} />);

    expect(
      screen.getByPlaceholderText("Enter your username")
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Enter your password")
    ).toBeInTheDocument();
  });

  test("password input has correct type", () => {
    render(<Login onLogin={mockOnLogin} />);

    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("form prevents submission with empty fields", async () => {
    const user = userEvent.setup();
    render(<Login onLogin={mockOnLogin} />);

    const submitButton = screen.getByRole("button", { name: "Sign In" });
    await user.click(submitButton);

    // API should not be called with empty fields due to HTML5 validation
    expect(ApiService.auth.login).not.toHaveBeenCalled();
  });

  test("disables form during loading", async () => {
    const user = userEvent.setup();

    ApiService.auth.login.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    render(<Login onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText("Username");
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign In" });

    await user.type(usernameInput, "testuser");
    await user.type(passwordInput, "testpassword");
    await user.click(submitButton);

    // Form elements should be disabled during loading
    expect(submitButton).toBeDisabled();

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  test("handles special characters in credentials", async () => {
    const user = userEvent.setup();

    const mockLoginResponse = {
      data: {
        user: { username: "user@domain.com" },
        access_token: "token",
      },
    };

    ApiService.auth.login.mockResolvedValue(mockLoginResponse);

    render(<Login onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText("Username");
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign In" });

    await user.type(usernameInput, "user@domain.com");
    await user.type(passwordInput, "p@ssw0rd!");
    await user.click(submitButton);

    await waitFor(() => {
      expect(ApiService.auth.login).toHaveBeenCalledWith({
        username: "user@domain.com",
        password: "p@ssw0rd!",
      });
    });
  });

  test("displays appropriate CSS classes", () => {
    render(<Login onLogin={mockOnLogin} />);

    expect(screen.getByTestId("auth-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("auth-container")).toBeInTheDocument();
    expect(screen.getByTestId("auth-title")).toBeInTheDocument();
    expect(screen.getByTestId("auth-form")).toBeInTheDocument();
  });

  test("error message has correct styling", async () => {
    const user = userEvent.setup();

    ApiService.auth.login.mockRejectedValue(new Error("Test error"));

    render(<Login onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText("Username");
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign In" });

    await user.type(usernameInput, "test");
    await user.type(passwordInput, "test");
    await user.click(submitButton);

    await waitFor(() => {
      const errorElement = screen.getByText(
        "Failed to login. Please check your credentials."
      );
      expect(errorElement).toHaveClass("auth-error");
    });
  });
});
