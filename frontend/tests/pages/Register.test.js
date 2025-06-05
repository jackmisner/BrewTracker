import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Register from "../../src/pages/Register";
import ApiService from "../../src/services/api";

// Mock the API service
jest.mock("../../src/services/api");

describe("Register Page", () => {
  const mockOnLogin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders the registration form", () => {
    render(<Register onLogin={mockOnLogin} />);

    expect(screen.getByTestId("auth-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("auth-container")).toBeInTheDocument();
    expect(screen.getByTestId("auth-title")).toHaveTextContent(
      "Create Account"
    );
    expect(screen.getByTestId("auth-subtitle")).toHaveTextContent(
      "Join the brewing community"
    );
  });

  test("renders navigation link to login", () => {
    render(<Register onLogin={mockOnLogin} />);

    expect(screen.getByText("Already have an account?")).toBeInTheDocument();
    expect(screen.getByText("Sign in here")).toBeInTheDocument();

    const loginLink = screen.getByText("Sign in here");
    expect(loginLink).toHaveAttribute("href", "/login");
  });

  test("handles form input changes", async () => {
    const user = userEvent.setup();
    render(<Register onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText("Username");
    const emailInput = screen.getByLabelText("Email Address");
    const passwordInput = screen.getByLabelText("Password");
    const confirmPasswordInput = screen.getByLabelText("Confirm Password");

    await user.type(usernameInput, "testuser");
    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "testpassword");
    await user.type(confirmPasswordInput, "testpassword");

    expect(usernameInput.value).toBe("testuser");
    expect(emailInput.value).toBe("test@example.com");
    expect(passwordInput.value).toBe("testpassword");
    expect(confirmPasswordInput.value).toBe("testpassword");
  });

  test("All fields are required", async () => {
    render(<Register onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText("Username");
    const emailInput = screen.getByLabelText("Email Address");
    const passwordInput = screen.getByLabelText("Password");
    const confirmPasswordInput = screen.getByLabelText("Confirm Password");

    expect(usernameInput).toBeRequired();
    expect(emailInput).toBeRequired();
    expect(passwordInput).toBeRequired();
    expect(confirmPasswordInput).toBeRequired();
  });

  test("shows error for empty fields on submit", async () => {
    render(<Register onLogin={mockOnLogin} />);
    const submitButton = screen.getByRole("button", { name: "Create Account" });
    fireEvent.click(submitButton);

    expect(ApiService.auth.register).not.toHaveBeenCalled();
  });

  test("password input has correct type", () => {
    render(<Register onLogin={mockOnLogin} />);

    const passwordInput = screen.getByLabelText("Password");
    const confirmPasswordInput = screen.getByLabelText("Confirm Password");
    expect(passwordInput).toHaveAttribute("type", "password");
    expect(confirmPasswordInput).toHaveAttribute("type", "password");
  });

  test("form inputs have correct placeholders", () => {
    render(<Register onLogin={mockOnLogin} />);

    expect(
      screen.getByPlaceholderText("Choose a username")
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter your email")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Create a password")
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Confirm your password")
    ).toBeInTheDocument();
  });

  test("successfully submits the form with valid data and logs in afterwards", async () => {
    render(<Register onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText("Username");
    const emailInput = screen.getByLabelText("Email Address");
    const passwordInput = screen.getByLabelText("Password");
    const confirmPasswordInput = screen.getByLabelText("Confirm Password");
    const submitButton = screen.getByRole("button", { name: "Create Account" });

    await userEvent.type(usernameInput, "testuser");
    await userEvent.type(emailInput, "test@example.com");
    await userEvent.type(passwordInput, "password123");
    await userEvent.type(confirmPasswordInput, "password123");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(ApiService.auth.register).toHaveBeenCalledWith({
        username: "testuser",
        email: "test@example.com",
        password: "password123",
      });
    });

    await waitFor(() => {
      expect(ApiService.auth.login).toHaveBeenCalledWith({
        username: "testuser",
        password: "password123",
      });
    });
  });

  test("handles registration form submission via enter key", async () => {
    const user = userEvent.setup();
    render(<Register onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText("Username");
    const emailInput = screen.getByLabelText("Email Address");
    const passwordInput = screen.getByLabelText("Password");
    const confirmPasswordInput = screen.getByLabelText("Confirm Password");

    await userEvent.type(usernameInput, "testuser");
    await userEvent.type(emailInput, "test@example.com");
    await userEvent.type(passwordInput, "password123");
    await userEvent.type(confirmPasswordInput, "password123");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(ApiService.auth.register).toHaveBeenCalledWith({
        username: "testuser",
        email: "test@example.com",
        password: "password123",
      });
    });

    await waitFor(() => {
      expect(ApiService.auth.login).toHaveBeenCalledWith({
        username: "testuser",
        password: "password123",
      });
    });
  });

  test("validates username length and shows/hides error", async () => {
    const user = userEvent.setup();
    render(<Register onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText("Username");

    // Test username too short
    await user.type(usernameInput, "ab");
    expect(
      screen.getByText("Username must be at least 3 characters")
    ).toBeInTheDocument();

    // Test username becomes valid (covers deletion of error)
    await user.type(usernameInput, "c");
    expect(
      screen.queryByText("Username must be at least 3 characters")
    ).not.toBeInTheDocument();
  });

  test("validates email format and shows/hides error", async () => {
    const user = userEvent.setup();
    render(<Register onLogin={mockOnLogin} />);

    const emailInput = screen.getByLabelText("Email Address");

    // Test invalid email
    await user.type(emailInput, "invalid-email");
    expect(
      screen.getByText("Please enter a valid email address")
    ).toBeInTheDocument();

    // Test email becomes valid - deletion of email error
    await user.clear(emailInput);
    await user.type(emailInput, "valid@email.com");
    expect(
      screen.queryByText("Please enter a valid email address")
    ).not.toBeInTheDocument();
  });

  test("validates password length and shows/hides error", async () => {
    const user = userEvent.setup();
    render(<Register onLogin={mockOnLogin} />);

    const passwordInput = screen.getByLabelText("Password");

    // Test password too short
    await user.type(passwordInput, "12345");
    expect(
      screen.getByText("Password must be at least 6 characters")
    ).toBeInTheDocument();

    // Test password becomes valid
    await user.type(passwordInput, "6");
    expect(
      screen.queryByText("Password must be at least 6 characters")
    ).not.toBeInTheDocument();
  });

  test("validates confirm password and shows/hides error", async () => {
    const user = userEvent.setup();
    render(<Register onLogin={mockOnLogin} />);

    const passwordInput = screen.getByLabelText("Password");
    const confirmPasswordInput = screen.getByLabelText("Confirm Password");

    // Set initial password
    await user.type(passwordInput, "password123");

    // Test mismatched confirm password
    await user.type(confirmPasswordInput, "different");
    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();

    // Test confirm password becomes matching - deletion of confirmPassword error
    await user.clear(confirmPasswordInput);
    await user.type(confirmPasswordInput, "password123");
    expect(
      screen.queryByText("Passwords do not match")
    ).not.toBeInTheDocument();
    expect(screen.getByText("Passwords match")).toBeInTheDocument();
  });

  test("validates confirm password when password changes", async () => {
    const user = userEvent.setup();
    render(<Register onLogin={mockOnLogin} />);

    const passwordInput = screen.getByLabelText("Password");
    const confirmPasswordInput = screen.getByLabelText("Confirm Password");

    // Set confirm password first
    await user.type(confirmPasswordInput, "password123");

    // Set different password (should trigger mismatch error)
    await user.type(passwordInput, "different123");
    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();

    // Change password to match (should remove error)
    await user.clear(passwordInput);
    await user.type(passwordInput, "password123");
    expect(
      screen.queryByText("Passwords do not match")
    ).not.toBeInTheDocument();
  });

  test("prevents submission when passwords don't match at final validation", async () => {
    const user = userEvent.setup();
    render(<Register onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText("Username");
    const emailInput = screen.getByLabelText("Email Address");
    const passwordInput = screen.getByLabelText("Password");
    const confirmPasswordInput = screen.getByLabelText("Confirm Password");
    const submitButton = screen.getByRole("button", {
      name: "Create Account",
    });

    // Fill form with valid data but mismatched passwords
    await user.type(usernameInput, "testuser");
    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "password123");
    await user.type(confirmPasswordInput, "password123");

    // Clear confirm password and add different password after validation passes
    await user.clear(confirmPasswordInput);
    await user.type(confirmPasswordInput, "differentpassword");

    // Submit form
    fireEvent.click(submitButton);

    // Should show password mismatch error
    await waitFor(() => {
      expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
    });

    expect(ApiService.auth.register).not.toHaveBeenCalled();
  });

  test("shows password requirements when password is valid", async () => {
    const user = userEvent.setup();
    render(<Register onLogin={mockOnLogin} />);

    const passwordInput = screen.getByLabelText("Password");

    // Type valid password
    await user.type(passwordInput, "password123");

    // Should show password requirements
    expect(screen.getByText("Password Requirements:")).toBeInTheDocument();
    expect(screen.getByText("At least 6 characters long")).toBeInTheDocument();
    expect(
      screen.getByText("Contains letters and numbers (recommended)")
    ).toBeInTheDocument();
  });

  test("handles API registration error", async () => {
    const user = userEvent.setup();
    ApiService.auth.register.mockRejectedValue({
      response: { data: { error: "Username already exists" } },
    });

    render(<Register onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText("Username");
    const emailInput = screen.getByLabelText("Email Address");
    const passwordInput = screen.getByLabelText("Password");
    const confirmPasswordInput = screen.getByLabelText("Confirm Password");
    const submitButton = screen.getByRole("button", {
      name: "Create Account",
    });

    await user.type(usernameInput, "testuser");
    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "password123");
    await user.type(confirmPasswordInput, "password123");

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Username already exists")).toBeInTheDocument();
    });

    expect(mockOnLogin).not.toHaveBeenCalled();
  });

  test("handles API error without response data", async () => {
    const user = userEvent.setup();
    ApiService.auth.register.mockRejectedValue(new Error("Network error"));

    render(<Register onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText("Username");
    const emailInput = screen.getByLabelText("Email Address");
    const passwordInput = screen.getByLabelText("Password");
    const confirmPasswordInput = screen.getByLabelText("Confirm Password");
    const submitButton = screen.getByRole("button", {
      name: "Create Account",
    });

    await user.type(usernameInput, "testuser");
    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "password123");
    await user.type(confirmPasswordInput, "password123");

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to register. Please check your information.")
      ).toBeInTheDocument();
    });

    expect(mockOnLogin).not.toHaveBeenCalled();
  });

  test("disables submit button when there are field errors", async () => {
    const user = userEvent.setup();
    render(<Register onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText("Username");
    const submitButton = screen.getByRole("button", {
      name: "Create Account",
    });

    // Type invalid username
    await user.type(usernameInput, "ab");

    // Submit button should be disabled
    expect(submitButton).toBeDisabled();
  });

  test("shows loading state during submission", async () => {
    const user = userEvent.setup();

    // Mock a slow API response
    ApiService.auth.register.mockImplementation(
      () =>
        new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 100))
    );
    ApiService.auth.login.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                data: { user: {}, access_token: "token" },
              }),
            100
          )
        )
    );

    render(<Register onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText("Username");
    const emailInput = screen.getByLabelText("Email Address");
    const passwordInput = screen.getByLabelText("Password");
    const confirmPasswordInput = screen.getByLabelText("Confirm Password");
    const submitButton = screen.getByRole("button", {
      name: "Create Account",
    });

    await user.type(usernameInput, "testuser");
    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "password123");
    await user.type(confirmPasswordInput, "password123");

    fireEvent.click(submitButton);

    // Button should be disabled and show loading state
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveClass("loading");
    expect(submitButton).toHaveTextContent("");

    // Wait for loading to complete
    await waitFor(() => {
      expect(mockOnLogin).toHaveBeenCalled();
    });
  });
});
