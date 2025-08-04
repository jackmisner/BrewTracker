// @ts-ignore - React needed for JSX in test files
import React from 'react';
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

    await user.type(usernameInput, "exampleuser");
    await user.type(emailInput, "example@example.com");
    await user.type(passwordInput, "TestPass123!");
    await user.type(confirmPasswordInput, "TestPass123!");

    expect((usernameInput as HTMLInputElement).value).toBe("exampleuser");
    expect((emailInput as HTMLInputElement).value).toBe("example@example.com");
    expect((passwordInput as HTMLInputElement).value).toBe("TestPass123!");
    expect((confirmPasswordInput as HTMLInputElement).value).toBe("TestPass123!");
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

  test("successfully submits the form with valid data and shows verification message", async () => {
    // Mock successful API responses
    (ApiService.auth.validateUsername as jest.Mock).mockResolvedValue({
      data: { valid: true, suggestions: [] }
    });
    (ApiService.auth.register as jest.Mock).mockResolvedValue({
      data: { 
        message: "User created successfully. Please check your email to verify your account.",
        verification_email_sent: true
      }
    });

    render(<Register onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText("Username");
    const emailInput = screen.getByLabelText("Email Address");
    const passwordInput = screen.getByLabelText("Password");
    const confirmPasswordInput = screen.getByLabelText("Confirm Password");
    const submitButton = screen.getByRole("button", { name: "Create Account" });

    await userEvent.type(usernameInput, "exampleuser");
    await userEvent.type(emailInput, "example@example.com");
    await userEvent.type(passwordInput, "TestPass123!");
    await userEvent.type(confirmPasswordInput, "TestPass123!");
    
    // Wait for username validation to complete (500ms debounce)
    await waitFor(() => {
      expect(ApiService.auth.validateUsername).toHaveBeenCalledWith({
        username: "exampleuser"
      });
    }, { timeout: 1000 });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(ApiService.auth.register).toHaveBeenCalledWith({
        username: "exampleuser",
        email: "example@example.com",
        password: "TestPass123!",
      });
    });

    // Should show success message instead of logging in
    await waitFor(() => {
      expect(screen.getByText("Account Created Successfully!")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/We've sent a verification email to/)).toBeInTheDocument();
    });

    // Should NOT call login
    expect(ApiService.auth.login).not.toHaveBeenCalled();
    expect(mockOnLogin).not.toHaveBeenCalled();
  });

  test("handles registration form submission via enter key", async () => {
    const user = userEvent.setup();
    
    // Mock successful API responses
    (ApiService.auth.validateUsername as jest.Mock).mockResolvedValue({
      data: { valid: true, suggestions: [] }
    });
    (ApiService.auth.register as jest.Mock).mockResolvedValue({
      data: { 
        message: "User created successfully. Please check your email to verify your account.",
        verification_email_sent: true
      }
    });

    render(<Register onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText("Username");
    const emailInput = screen.getByLabelText("Email Address");
    const passwordInput = screen.getByLabelText("Password");
    const confirmPasswordInput = screen.getByLabelText("Confirm Password");

    await userEvent.type(usernameInput, "exampleuser");
    await userEvent.type(emailInput, "example@example.com");
    await userEvent.type(passwordInput, "TestPass123!");
    await userEvent.type(confirmPasswordInput, "TestPass123!");
    
    // Wait for username validation to complete (500ms debounce)
    await waitFor(() => {
      expect(ApiService.auth.validateUsername).toHaveBeenCalledWith({
        username: "exampleuser"
      });
    }, { timeout: 1000 });

    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(ApiService.auth.register).toHaveBeenCalledWith({
        username: "exampleuser",
        email: "example@example.com",
        password: "TestPass123!",
      });
    });

    // Should show success message instead of logging in
    await waitFor(() => {
      expect(screen.getByText("Account Created Successfully!")).toBeInTheDocument();
    });

    // Should NOT call login
    expect(ApiService.auth.login).not.toHaveBeenCalled();
    expect(mockOnLogin).not.toHaveBeenCalled();
  });

  test("validates username length and shows/hides error", async () => {
    const user = userEvent.setup();
    
    // Mock username validation responses - first call will be for "abc" (valid)
    (ApiService.auth.validateUsername as jest.Mock).mockResolvedValue({
      data: { valid: true, suggestions: [] }
    });

    render(<Register onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText("Username");

    // Test username too short - this triggers immediate validation (no API call)
    await user.type(usernameInput, "ab");
    
    expect(
      screen.getByText("Username must be at least 3 characters")
    ).toBeInTheDocument();

    // Test username becomes valid - this will trigger async validation after 500ms
    await user.type(usernameInput, "c");
    
    // Wait for async validation to complete and clear the error
    await waitFor(() => {
      expect(ApiService.auth.validateUsername).toHaveBeenCalledWith({
        username: "abc"
      });
    }, { timeout: 1000 });
    
    await waitFor(() => {
      expect(
        screen.queryByText("Username must be at least 3 characters")
      ).not.toBeInTheDocument();
    });
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
    await user.type(passwordInput, "1234567");
    expect(
      screen.getByText("Password must be at least 8 characters long")
    ).toBeInTheDocument();

    // Test password becomes valid length (but may have other validation errors)
    await user.type(passwordInput, "8");
    expect(
      screen.queryByText("Password must be at least 8 characters long")
    ).not.toBeInTheDocument();
  });

  test("validates confirm password and shows/hides error", async () => {
    const user = userEvent.setup();
    render(<Register onLogin={mockOnLogin} />);

    const passwordInput = screen.getByLabelText("Password");
    const confirmPasswordInput = screen.getByLabelText("Confirm Password");

    // Set initial password
    await user.type(passwordInput, "TestPass123!");

    // Test mismatched confirm password
    await user.type(confirmPasswordInput, "different");
    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();

    // Test confirm password becomes matching - deletion of confirmPassword error
    await user.clear(confirmPasswordInput);
    await user.type(confirmPasswordInput, "TestPass123!");
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
    await user.type(confirmPasswordInput, "TestPass123!");

    // Set different password (should trigger mismatch error)
    await user.type(passwordInput, "Different456!");
    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();

    // Change password to match (should remove error)
    await user.clear(passwordInput);
    await user.type(passwordInput, "TestPass123!");
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
    await user.type(usernameInput, "exampleuser");
    await user.type(emailInput, "example@example.com");
    await user.type(passwordInput, "TestPass123!");
    await user.type(confirmPasswordInput, "TestPass123!");

    // Clear confirm password and add different password after validation passes
    await user.clear(confirmPasswordInput);
    await user.type(confirmPasswordInput, "DifferentPass789!");

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
    await user.type(passwordInput, "TestPass123!");

    // Should show password requirements
    expect(screen.getByText("Password Requirements:")).toBeInTheDocument();
    expect(screen.getByText("✓ At least 8 characters long")).toBeInTheDocument();
    expect(screen.getByText("✓ Contains at least one lowercase letter")).toBeInTheDocument();
  });

  test("handles API registration error", async () => {
    const user = userEvent.setup();
    
    // Mock username validation to pass
    (ApiService.auth.validateUsername as jest.Mock).mockResolvedValue({
      data: { valid: true, suggestions: [] }
    });
    
    // Mock registration to fail
    (ApiService.auth.register as jest.Mock).mockRejectedValue({
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

    await user.type(usernameInput, "exampleuser");
    await user.type(emailInput, "example@example.com");
    await user.type(passwordInput, "TestPass123!");
    await user.type(confirmPasswordInput, "TestPass123!");

    // Wait for username validation to complete (500ms debounce)
    await waitFor(() => {
      expect(ApiService.auth.validateUsername).toHaveBeenCalledWith({
        username: "exampleuser"
      });
    }, { timeout: 1000 });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Username already exists")).toBeInTheDocument();
    });

    expect(mockOnLogin).not.toHaveBeenCalled();
  });

  test("handles API error without response data", async () => {
    const user = userEvent.setup();
    
    // Mock username validation to pass
    (ApiService.auth.validateUsername as jest.Mock).mockResolvedValue({
      data: { valid: true, suggestions: [] }
    });
    
    // Mock registration to fail with network error
    (ApiService.auth.register as jest.Mock).mockRejectedValue(new Error("Network error"));

    render(<Register onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText("Username");
    const emailInput = screen.getByLabelText("Email Address");
    const passwordInput = screen.getByLabelText("Password");
    const confirmPasswordInput = screen.getByLabelText("Confirm Password");
    const submitButton = screen.getByRole("button", {
      name: "Create Account",
    });

    await user.type(usernameInput, "exampleuser");
    await user.type(emailInput, "example@example.com");
    await user.type(passwordInput, "TestPass123!");
    await user.type(confirmPasswordInput, "TestPass123!");

    // Wait for username validation to complete (500ms debounce)
    await waitFor(() => {
      expect(ApiService.auth.validateUsername).toHaveBeenCalledWith({
        username: "exampleuser"
      });
    }, { timeout: 1000 });

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

    // Mock username validation to pass quickly
    (ApiService.auth.validateUsername as jest.Mock).mockResolvedValue({
      data: { valid: true, suggestions: [] }
    });

    // Mock a slow API response for registration
    (ApiService.auth.register as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => setTimeout(() => resolve({ 
          data: {
            message: "User created successfully. Please check your email to verify your account.",
            verification_email_sent: true
          }
        }), 100))
    );

    render(<Register onLogin={mockOnLogin} />);

    const usernameInput = screen.getByLabelText("Username");
    const emailInput = screen.getByLabelText("Email Address");
    const passwordInput = screen.getByLabelText("Password");
    const confirmPasswordInput = screen.getByLabelText("Confirm Password");
    const submitButton = screen.getByRole("button", {
      name: "Create Account",
    });

    await user.type(usernameInput, "exampleuser");
    await user.type(emailInput, "example@example.com");
    await user.type(passwordInput, "TestPass123!");
    await user.type(confirmPasswordInput, "TestPass123!");

    // Wait for username validation to complete (500ms debounce)
    await waitFor(() => {
      expect(ApiService.auth.validateUsername).toHaveBeenCalledWith({
        username: "exampleuser"
      });
    }, { timeout: 1000 });

    fireEvent.click(submitButton);

    // Button should be disabled and show loading state
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveClass("loading");
    expect(submitButton).toHaveTextContent("");

    // Wait for loading to complete and success message to appear
    await waitFor(() => {
      expect(screen.getByText("Account Created Successfully!")).toBeInTheDocument();
    });

    // Should NOT call login
    expect(ApiService.auth.login).not.toHaveBeenCalled();
    expect(mockOnLogin).not.toHaveBeenCalled();
  });
});
