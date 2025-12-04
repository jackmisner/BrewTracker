import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import UserSettings from "../../src/pages/UserSettings";
import UserSettingsService from "../../src/services/User/UserSettingsService";

import { renderWithProviders, scenarios } from "../testUtils";

// Mock the UserSettingsService
jest.mock("../../src/services/User/UserSettingsService", () => ({
  getUserSettings: jest.fn(),
  updateProfile: jest.fn(),
  changePassword: jest.fn(),
  updateSettings: jest.fn(),
  deleteAccount: jest.fn(),
}));

// Mock the UnitContext
const mockUpdateUnitSystem = jest.fn();
const mockUseUnits = {
  unitSystem: "imperial",
  updateUnitSystem: mockUpdateUnitSystem,
  loading: false,
};

jest.mock("../../src/contexts/UnitContext", () => ({
  useUnits: () => mockUseUnits,
  UnitProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock useNavigate and useBlocker
const mockNavigate = jest.fn();
const mockBlocker = {
  state: "unblocked",
  reset: jest.fn(),
  proceed: jest.fn(),
};
jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigate,
  useBlocker: () => mockBlocker,
  Outlet: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock window.confirm
const mockConfirm = jest.fn();
global.confirm = mockConfirm;

// Suppress console errors during tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe("UserSettings", () => {
  const sampleUserSettings = {
    user: {
      username: "testuser",
      email: "test@example.com",
      created_at: "2024-01-01T00:00:00Z",
      last_login: "2024-01-15T00:00:00Z",
    },
    settings: {
      default_batch_size: 5.0,
      preferred_units: "imperial",
      timezone: "UTC",
      email_notifications: true,
      brew_reminders: true,
      contribute_anonymous_data: false,
      share_yeast_performance: false,
      share_recipe_metrics: false,
      public_recipes_default: false,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
    mockUpdateUnitSystem.mockClear();
    mockConfirm.mockClear();
    mockBlocker.reset.mockClear();
    mockBlocker.proceed.mockClear();
    mockBlocker.state = "unblocked";

    // Default successful API response
    (UserSettingsService.getUserSettings as jest.Mock).mockResolvedValue(
      sampleUserSettings
    );
    (UserSettingsService.updateProfile as jest.Mock).mockResolvedValue({});
    (UserSettingsService.changePassword as jest.Mock).mockResolvedValue({});
    (UserSettingsService.updateSettings as jest.Mock).mockResolvedValue({});
    (UserSettingsService.deleteAccount as jest.Mock).mockResolvedValue({});

    // Reset localStorage mock
    global.mockLocalStorage.clear();

    // Reset unit context mock
    mockUseUnits.unitSystem = "imperial";
    mockUseUnits.loading = false;
  });

  describe("Initial render and loading", () => {
    it("shows loading state initially", () => {
      (UserSettingsService.getUserSettings as jest.Mock).mockImplementation(
        () => scenarios.loading()
      );

      renderWithProviders(<UserSettings />);

      expect(screen.getByText("Loading settings...")).toBeInTheDocument();
    });

    it("renders page title and navigation tabs", async () => {
      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading settings...")
        ).not.toBeInTheDocument();
      });

      expect(screen.getByText("Account Settings")).toBeInTheDocument();
      expect(
        screen.getByText("Manage your account and preferences")
      ).toBeInTheDocument();

      // Check all tabs are present
      expect(screen.getByText("Account")).toBeInTheDocument();
      expect(screen.getByText("Preferences")).toBeInTheDocument();
      expect(screen.getByText("Privacy")).toBeInTheDocument();
      expect(screen.getByText("Security")).toBeInTheDocument();
    });

    it("calls getUserSettings on mount", () => {
      renderWithProviders(<UserSettings />);

      expect(UserSettingsService.getUserSettings).toHaveBeenCalledTimes(1);
    });

    it("displays account tab by default", async () => {
      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(screen.getByText("Account Information")).toBeInTheDocument();
      });

      expect(screen.getByDisplayValue("testuser")).toBeInTheDocument();
      expect(screen.getByDisplayValue("test@example.com")).toBeInTheDocument();
    });

    it("populates forms with user data after loading", async () => {
      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("testuser")).toBeInTheDocument();
      });

      expect(screen.getByDisplayValue("test@example.com")).toBeInTheDocument();
    });
  });

  describe("Error handling", () => {
    it("displays error message when settings fail to load", async () => {
      (UserSettingsService.getUserSettings as jest.Mock).mockRejectedValue(
        new Error("API Error")
      );

      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(
          screen.getByText("Failed to load user settings")
        ).toBeInTheDocument();
      });

      expect(screen.queryByText("Loading settings...")).not.toBeInTheDocument();
    });

    it("logs error to console when settings fail to load", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      (UserSettingsService.getUserSettings as jest.Mock).mockRejectedValue(
        new Error("Network Error")
      );

      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "Error loading settings:",
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });

    it("can dismiss error messages", async () => {
      (UserSettingsService.getUserSettings as jest.Mock).mockRejectedValue(
        new Error("API Error")
      );

      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(
          screen.getByText("Failed to load user settings")
        ).toBeInTheDocument();
      });

      const dismissButton = screen.getByText("×");
      fireEvent.click(dismissButton);

      expect(
        screen.queryByText("Failed to load user settings")
      ).not.toBeInTheDocument();
    });
  });

  describe("Tab navigation", () => {
    it("switches to preferences tab when clicked", async () => {
      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading settings...")
        ).not.toBeInTheDocument();
      });

      const preferencesTab = screen.getByText("Preferences");
      fireEvent.click(preferencesTab);

      expect(screen.getByText("Application Preferences")).toBeInTheDocument();
      expect(screen.getByText("Unit System")).toBeInTheDocument();
    });

    it("switches to privacy tab when clicked", async () => {
      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading settings...")
        ).not.toBeInTheDocument();
      });

      const privacyTab = screen.getByText("Privacy");
      fireEvent.click(privacyTab);

      expect(screen.getByText("Privacy Settings")).toBeInTheDocument();
      expect(screen.getByText("Data Sharing")).toBeInTheDocument();
    });

    it("switches to security tab when clicked", async () => {
      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading settings...")
        ).not.toBeInTheDocument();
      });

      const securityTab = screen.getByText("Security");
      fireEvent.click(securityTab);

      expect(screen.getByText("Danger Zone")).toBeInTheDocument();
      expect(screen.getByLabelText("Current Password")).toBeInTheDocument();
    });

    it("applies active class to current tab", async () => {
      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading settings...")
        ).not.toBeInTheDocument();
      });

      const accountTab = screen.getByText("Account").closest("button");
      expect(accountTab).toHaveClass("active");

      const preferencesTab = screen.getByText("Preferences").closest("button");
      fireEvent.click(preferencesTab);

      expect(preferencesTab).toHaveClass("active");
      expect(accountTab).not.toHaveClass("active");
    });
  });

  describe("Account tab - Profile form", () => {
    it("allows editing username and email", async () => {
      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("testuser")).toBeInTheDocument();
      });

      const usernameInput = screen.getByDisplayValue("testuser");
      const emailInput = screen.getByDisplayValue("test@example.com");

      fireEvent.change(usernameInput, { target: { value: "newusername" } });
      fireEvent.change(emailInput, { target: { value: "new@example.com" } });

      expect((usernameInput as HTMLInputElement).value).toBe("newusername");
      expect((emailInput as HTMLInputElement).value).toBe("new@example.com");
    });

    it("submits profile form successfully", async () => {
      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("testuser")).toBeInTheDocument();
      });

      const usernameInput = screen.getByDisplayValue("testuser");
      const updateButton = screen.getByText("Update Profile");

      fireEvent.change(usernameInput, { target: { value: "newusername" } });
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(UserSettingsService.updateProfile).toHaveBeenCalledWith({
          username: "newusername",
          email: "test@example.com",
        });
      });

      await waitFor(() => {
        expect(
          screen.getByText("Profile updated successfully")
        ).toBeInTheDocument();
      });
    });

    it("handles profile update error", async () => {
      (UserSettingsService.updateProfile as jest.Mock).mockRejectedValue(
        new Error("Update failed")
      );

      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("testuser")).toBeInTheDocument();
      });

      const updateButton = screen.getByText("Update Profile");
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(screen.getByText("Update failed")).toBeInTheDocument();
      });
    });

    it("shows saving state during profile update", async () => {
      (UserSettingsService.updateProfile as jest.Mock).mockImplementation(() =>
        scenarios.loading()
      );

      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("testuser")).toBeInTheDocument();
      });

      const updateButton = screen.getByText("Update Profile");
      fireEvent.click(updateButton);

      expect(screen.getByText("Saving...")).toBeInTheDocument();
      expect(updateButton).toBeDisabled();
    });

    it("displays account information correctly", async () => {
      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(screen.getByText("Member Since:")).toBeInTheDocument();
      });

      expect(screen.getByText("1/1/2024")).toBeInTheDocument();
      expect(screen.getByText("1/15/2024")).toBeInTheDocument();
      expect(screen.getByText("Active")).toBeInTheDocument();
    });

    it("handles null last_login gracefully", async () => {
      const settingsWithoutLogin = {
        ...sampleUserSettings,
        user: { ...sampleUserSettings.user, last_login: null },
      };
      (UserSettingsService.getUserSettings as jest.Mock).mockResolvedValue(
        settingsWithoutLogin
      );

      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(screen.getByText("Last Login:")).toBeInTheDocument();
      });

      expect(screen.getByText("Never")).toBeInTheDocument();
    });
  });

  describe("Preferences tab - Unit system", () => {
    beforeEach(async () => {
      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading settings...")
        ).not.toBeInTheDocument();
      });

      const preferencesTab = screen.getByRole("button", {
        name: /Preferences/,
      });
      fireEvent.click(preferencesTab);
    });

    it("displays current unit system correctly", () => {
      const imperialButton = screen.getByText("Imperial").closest("button");
      const metricButton = screen.getByText("Metric").closest("button");

      expect(imperialButton).toHaveClass("active");
      expect(metricButton).not.toHaveClass("active");
    });

    it("switches to metric when metric button is clicked", () => {
      const metricButton = screen.getByText("Metric").closest("button");
      fireEvent.click(metricButton);

      // Should update button active state immediately
      expect(metricButton).toHaveClass("active");
      const imperialButton = screen.getByText("Imperial").closest("button");
      expect(imperialButton).not.toHaveClass("active");

      // Should not call updateUnitSystem immediately
      expect(mockUpdateUnitSystem).not.toHaveBeenCalled();
    });

    it("sets default batch size to 19L when switching to metric", () => {
      const metricButton = screen.getByText("Metric").closest("button");
      fireEvent.click(metricButton);

      const batchSizeInput = screen.getByDisplayValue("19");
      expect(batchSizeInput).toBeInTheDocument();
    });

    it("sets default batch size to 5 gallons when switching to imperial", () => {
      // First switch to metric
      const metricButton = screen.getByText("Metric").closest("button");
      fireEvent.click(metricButton);

      // Then switch back to imperial
      const imperialButton = screen.getByText("Imperial").closest("button");
      fireEvent.click(imperialButton);

      const batchSizeInput = screen.getByDisplayValue("5");
      expect(batchSizeInput).toBeInTheDocument();
    });

    it("shows correct unit labels based on selected system", () => {
      // Initially imperial
      expect(
        screen.getByText("Default Batch Size (gallons)")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Typical homebrew batch: 5 gallons")
      ).toBeInTheDocument();

      // Switch to metric
      const metricButton = screen.getByText("Metric").closest("button");
      fireEvent.click(metricButton);

      expect(
        screen.getByText("Default Batch Size (liters)")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Typical homebrew batch: 19-23 liters")
      ).toBeInTheDocument();
    });
  });

  describe("Preferences tab - Form submission", () => {
    beforeEach(async () => {
      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading settings...")
        ).not.toBeInTheDocument();
      });

      const preferencesTab = screen.getByText("Preferences");
      fireEvent.click(preferencesTab);
    });

    it("updates batch size", () => {
      const batchSizeInput = screen.getByDisplayValue("5");
      fireEvent.change(batchSizeInput, { target: { value: "10" } });

      expect((batchSizeInput as HTMLInputElement).value).toBe("10");
    });

    it("toggles notification preferences", () => {
      const emailCheckbox = screen.getByLabelText("Email notifications");
      const brewCheckbox = screen.getByLabelText("Brewing reminders");

      expect(emailCheckbox).toBeChecked();
      expect(brewCheckbox).toBeChecked();

      fireEvent.click(emailCheckbox);
      expect(emailCheckbox).not.toBeChecked();
    });

    it("submits preferences form successfully", async () => {
      const batchSizeInput = screen.getByDisplayValue("5");
      fireEvent.change(batchSizeInput, { target: { value: "7.5" } });

      const saveButton = screen.getByText("Save Preferences");
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(UserSettingsService.updateSettings).toHaveBeenCalledWith(
          expect.objectContaining({
            default_batch_size: 7.5,
            preferred_units: "imperial",
          })
        );
      });

      await waitFor(() => {
        expect(mockUpdateUnitSystem).toHaveBeenCalledWith("imperial");
      });

      await waitFor(() => {
        expect(
          screen.getByText("Preferences updated successfully")
        ).toBeInTheDocument();
      });
    });

    it("submits unit system changes with form", async () => {
      // Switch to metric
      const metricButton = screen.getByText("Metric").closest("button");
      fireEvent.click(metricButton);

      const saveButton = screen.getByText("Save Preferences");
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(UserSettingsService.updateSettings).toHaveBeenCalledWith(
          expect.objectContaining({
            preferred_units: "metric",
            default_batch_size: 19,
          })
        );
      });

      await waitFor(() => {
        expect(mockUpdateUnitSystem).toHaveBeenCalledWith("metric");
      });
    });

    it("handles preferences update error", async () => {
      (UserSettingsService.updateSettings as jest.Mock).mockRejectedValue(
        new Error("Preferences failed")
      );

      const saveButton = screen.getByText("Save Preferences");
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText("Preferences failed")).toBeInTheDocument();
      });
    });
  });

  describe("Privacy tab", () => {
    beforeEach(async () => {
      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading settings...")
        ).not.toBeInTheDocument();
      });

      const privacyTab = screen.getByText("Privacy");
      fireEvent.click(privacyTab);
    });

    it("displays privacy options", () => {
      expect(
        screen.getByText("Contribute Anonymous Brewing Data")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Share Yeast Performance Data")
      ).toBeInTheDocument();
      expect(screen.getByText("Share Recipe Metrics")).toBeInTheDocument();
      expect(
        screen.getByText("Make New Recipes Public by Default")
      ).toBeInTheDocument();
    });

    it("toggles privacy settings", () => {
      const anonymousDataCheckbox = screen.getByLabelText(
        /Contribute Anonymous Brewing Data/
      );
      const yeastDataCheckbox = screen.getByLabelText(
        /Share Yeast Performance Data/
      );

      expect(anonymousDataCheckbox).not.toBeChecked();
      expect(yeastDataCheckbox).not.toBeChecked();

      fireEvent.click(anonymousDataCheckbox);
      fireEvent.click(yeastDataCheckbox);

      expect(anonymousDataCheckbox).toBeChecked();
      expect(yeastDataCheckbox).toBeChecked();
    });

    it("submits privacy form successfully", async () => {
      const anonymousDataCheckbox = screen.getByLabelText(
        /Contribute Anonymous Brewing Data/
      );
      fireEvent.click(anonymousDataCheckbox);

      const saveButton = screen.getByText("Save Privacy Settings");
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(UserSettingsService.updateSettings).toHaveBeenCalledWith(
          expect.objectContaining({
            contribute_anonymous_data: true,
          })
        );
      });

      await waitFor(() => {
        expect(
          screen.getByText("Privacy settings updated successfully")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Security tab - Password change", () => {
    beforeEach(async () => {
      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading settings...")
        ).not.toBeInTheDocument();
      });

      const securityTab = screen.getByText("Security");
      fireEvent.click(securityTab);
    });

    it("displays password change form", () => {
      expect(screen.getByLabelText("Current Password")).toBeInTheDocument();
      expect(screen.getByLabelText("New Password")).toBeInTheDocument();
      expect(screen.getByLabelText("Confirm New Password")).toBeInTheDocument();
    });

    it("allows entering password information", () => {
      const currentPasswordInput = screen.getByLabelText("Current Password");
      const newPasswordInput = screen.getByLabelText("New Password");
      const confirmPasswordInput = screen.getByLabelText(
        "Confirm New Password"
      );

      fireEvent.change(currentPasswordInput, {
        target: { value: "OldPass123!" },
      });
      fireEvent.change(newPasswordInput, { target: { value: "NewPass123!" } });
      fireEvent.change(confirmPasswordInput, {
        target: { value: "NewPass123!" },
      });

      expect((currentPasswordInput as HTMLInputElement).value).toBe(
        "OldPass123!"
      );
      expect((newPasswordInput as HTMLInputElement).value).toBe("NewPass123!");
      expect((confirmPasswordInput as HTMLInputElement).value).toBe(
        "NewPass123!"
      );
    });

    it("submits password change successfully", async () => {
      const currentPasswordInput = screen.getByLabelText("Current Password");
      const newPasswordInput = screen.getByLabelText("New Password");
      const confirmPasswordInput = screen.getByLabelText(
        "Confirm New Password"
      );

      fireEvent.change(currentPasswordInput, {
        target: { value: "OldPass123!" },
      });
      fireEvent.change(newPasswordInput, { target: { value: "NewPass123!" } });
      fireEvent.change(confirmPasswordInput, {
        target: { value: "NewPass123!" },
      });

      const changeButton = screen.getByRole("button", {
        name: "Change Password",
      });
      fireEvent.click(changeButton);

      await waitFor(() => {
        expect(UserSettingsService.changePassword).toHaveBeenCalledWith({
          current_password: "OldPass123!",
          new_password: "NewPass123!",
          confirm_password: "NewPass123!",
        });
      });

      await waitFor(() => {
        expect(
          screen.getByText("Password changed successfully")
        ).toBeInTheDocument();
      });

      // Form should be cleared
      expect((currentPasswordInput as HTMLInputElement).value).toBe("");
      expect((newPasswordInput as HTMLInputElement).value).toBe("");
      expect((confirmPasswordInput as HTMLInputElement).value).toBe("");
    });

    it("handles password change error", async () => {
      (UserSettingsService.changePassword as jest.Mock).mockRejectedValue(
        new Error("Wrong password")
      );

      const changeButton = screen.getByRole("button", {
        name: "Change Password",
      });
      fireEvent.click(changeButton);

      await waitFor(() => {
        expect(screen.getByText("Wrong password")).toBeInTheDocument();
      });
    });
  });

  describe("Security tab - Account deletion", () => {
    beforeEach(async () => {
      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading settings...")
        ).not.toBeInTheDocument();
      });

      const securityTab = screen.getByText("Security");
      fireEvent.click(securityTab);
    });

    it("displays account deletion form", () => {
      expect(screen.getByText("Danger Zone")).toBeInTheDocument();
      expect(
        screen.getByLabelText("Enter your password to confirm")
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText('Type "DELETE" to confirm')
      ).toBeInTheDocument();
    });

    it("disables delete button when confirmation is incorrect", () => {
      const passwordInput = screen.getByLabelText(
        "Enter your password to confirm"
      );
      const confirmationInput = screen.getByLabelText(
        'Type "DELETE" to confirm'
      );
      const deleteButton = screen.getByText("Delete Account");

      fireEvent.change(passwordInput, { target: { value: "password" } });
      fireEvent.change(confirmationInput, { target: { value: "WRONG" } });

      expect(deleteButton).toBeDisabled();
    });

    it("enables delete button when form is correctly filled", () => {
      const passwordInput = screen.getByLabelText(
        "Enter your password to confirm"
      );
      const confirmationInput = screen.getByLabelText(
        'Type "DELETE" to confirm'
      );
      const deleteButton = screen.getByText("Delete Account");

      fireEvent.change(passwordInput, { target: { value: "password" } });
      fireEvent.change(confirmationInput, { target: { value: "DELETE" } });

      expect(deleteButton).not.toBeDisabled();
    });

    it("shows confirmation dialog before deletion", async () => {
      mockConfirm.mockReturnValue(false);

      const passwordInput = screen.getByLabelText(
        "Enter your password to confirm"
      );
      const confirmationInput = screen.getByLabelText(
        'Type "DELETE" to confirm'
      );
      const deleteButton = screen.getByText("Delete Account");

      fireEvent.change(passwordInput, { target: { value: "password" } });
      fireEvent.change(confirmationInput, { target: { value: "DELETE" } });
      fireEvent.click(deleteButton);

      expect(mockConfirm).toHaveBeenCalledWith(
        "Are you absolutely sure you want to delete your account? This action cannot be undone."
      );

      expect(UserSettingsService.deleteAccount).not.toHaveBeenCalled();
    });

    it("deletes account and redirects when confirmed", async () => {
      mockConfirm.mockReturnValue(true);

      const passwordInput = screen.getByLabelText(
        "Enter your password to confirm"
      );
      const confirmationInput = screen.getByLabelText(
        'Type "DELETE" to confirm'
      );
      const deleteButton = screen.getByText("Delete Account");

      fireEvent.change(passwordInput, { target: { value: "password" } });
      fireEvent.change(confirmationInput, { target: { value: "DELETE" } });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(UserSettingsService.deleteAccount).toHaveBeenCalledWith({
          password: "password",
          confirmation: "DELETE",
          preserve_public_recipes: true,
        });
      });

      expect(global.mockLocalStorage.removeItem).toHaveBeenCalledWith("token");
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });

    it("handles account deletion error", async () => {
      mockConfirm.mockReturnValue(true);
      (UserSettingsService.deleteAccount as jest.Mock).mockRejectedValue(
        new Error("Deletion failed")
      );

      const passwordInput = screen.getByLabelText(
        "Enter your password to confirm"
      );
      const confirmationInput = screen.getByLabelText(
        'Type "DELETE" to confirm'
      );
      const deleteButton = screen.getByText("Delete Account");

      fireEvent.change(passwordInput, { target: { value: "password" } });
      fireEvent.change(confirmationInput, { target: { value: "DELETE" } });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText("Deletion failed")).toBeInTheDocument();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe("Success message handling", () => {
    it("auto-dismisses success messages after 3 seconds", async () => {
      jest.useFakeTimers();

      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("testuser")).toBeInTheDocument();
      });

      const updateButton = screen.getByText("Update Profile");
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(
          screen.getByText("Profile updated successfully")
        ).toBeInTheDocument();
      });

      // Fast-forward time
      jest.advanceTimersByTime(3000);

      await waitFor(() => {
        expect(
          screen.queryByText("Profile updated successfully")
        ).not.toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    it("can manually dismiss success messages", async () => {
      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("testuser")).toBeInTheDocument();
      });

      const updateButton = screen.getByText("Update Profile");
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(
          screen.getByText("Profile updated successfully")
        ).toBeInTheDocument();
      });

      const dismissButtons = screen.getAllByText("×");
      const successDismissButton = dismissButtons.find(button =>
        button.closest(".success-banner")
      );

      fireEvent.click(successDismissButton);

      expect(
        screen.queryByText("Profile updated successfully")
      ).not.toBeInTheDocument();
    });
  });

  describe("Form validation and edge cases", () => {
    it("requires all fields in profile form", async () => {
      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("testuser")).toBeInTheDocument();
      });

      const usernameInput = screen.getByDisplayValue("testuser");
      const emailInput = screen.getByDisplayValue("test@example.com");

      expect(usernameInput).toHaveAttribute("required");
      expect(emailInput).toHaveAttribute("required");
      expect(emailInput).toHaveAttribute("type", "email");
    });

    it("validates password length", async () => {
      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading settings...")
        ).not.toBeInTheDocument();
      });

      const securityTab = screen.getByText("Security");
      fireEvent.click(securityTab);

      const newPasswordInput = screen.getByLabelText("New Password");
      expect(newPasswordInput).toHaveAttribute("minLength", "8");
    });

    it("handles batch size input constraints", async () => {
      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading settings...")
        ).not.toBeInTheDocument();
      });

      const preferencesTab = screen.getByText("Preferences");
      fireEvent.click(preferencesTab);

      const batchSizeInput = screen.getByDisplayValue("5");
      expect(batchSizeInput).toHaveAttribute("min", "0.5");
      expect(batchSizeInput).toHaveAttribute("max", "100");
      expect(batchSizeInput).toHaveAttribute("step", "0.5");
    });
  });

  describe("Unsaved changes warning", () => {
    it("does not show navigation warning when no changes are made", async () => {
      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading settings...")
        ).not.toBeInTheDocument();
      });

      // Should not show modal when no changes
      expect(screen.queryByText("Unsaved Changes")).not.toBeInTheDocument();
    });

    it("shows navigation warning when profile form has unsaved changes", async () => {
      mockBlocker.state = "blocked";

      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("testuser")).toBeInTheDocument();
      });

      // Make a change but don't save
      const usernameInput = screen.getByDisplayValue("testuser");
      fireEvent.change(usernameInput, { target: { value: "newusername" } });

      // Re-render to show the modal
      renderWithProviders(<UserSettings />);

      expect(screen.getByText("Unsaved Changes")).toBeInTheDocument();
      expect(
        screen.getByText(
          "You have unsaved changes that will be lost. Are you sure you want to leave this page?"
        )
      ).toBeInTheDocument();
    });

    it("shows navigation warning when preferences form has unsaved changes", async () => {
      mockBlocker.state = "blocked";

      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading settings...")
        ).not.toBeInTheDocument();
      });

      // Switch to preferences tab
      const preferencesTab = screen.getByText("Preferences");
      fireEvent.click(preferencesTab);

      // Make a change to unit system
      const metricButton = screen.getByText("Metric").closest("button");
      fireEvent.click(metricButton);

      // Re-render to show the modal
      renderWithProviders(<UserSettings />);

      expect(screen.getByText("Unsaved Changes")).toBeInTheDocument();
    });

    it("allows staying on page when unsaved changes warning is shown", async () => {
      mockBlocker.state = "blocked";

      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(screen.getByText("Stay on Page")).toBeInTheDocument();
      });

      const stayButton = screen.getByText("Stay on Page");
      fireEvent.click(stayButton);

      expect(mockBlocker.reset).toHaveBeenCalledTimes(1);
    });

    it("allows leaving without saving when unsaved changes warning is shown", async () => {
      mockBlocker.state = "blocked";

      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(screen.getByText("Leave Without Saving")).toBeInTheDocument();
      });

      const leaveButton = screen.getByText("Leave Without Saving");
      fireEvent.click(leaveButton);

      expect(mockBlocker.proceed).toHaveBeenCalledTimes(1);
    });

    it("clears unsaved changes state after successful form submission", async () => {
      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("testuser")).toBeInTheDocument();
      });

      // Make a change
      const usernameInput = screen.getByDisplayValue("testuser");
      fireEvent.change(usernameInput, { target: { value: "newusername" } });

      // Save the form
      const updateButton = screen.getByText("Update Profile");
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(
          screen.getByText("Profile updated successfully")
        ).toBeInTheDocument();
      });

      // Changes should be cleared, so no navigation warning
      expect(screen.queryByText("Unsaved Changes")).not.toBeInTheDocument();
    });

    it("clears unsaved changes state after successful preferences submission", async () => {
      renderWithProviders(<UserSettings />);

      await waitFor(() => {
        expect(
          screen.queryByText("Loading settings...")
        ).not.toBeInTheDocument();
      });

      // Switch to preferences tab
      const preferencesTab = screen.getByText("Preferences");
      fireEvent.click(preferencesTab);

      // Make a change
      const metricButton = screen.getByText("Metric").closest("button");
      fireEvent.click(metricButton);

      // Save the form
      const saveButton = screen.getByText("Save Preferences");
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(
          screen.getByText("Preferences updated successfully")
        ).toBeInTheDocument();
      });

      // Changes should be cleared
      expect(screen.queryByText("Unsaved Changes")).not.toBeInTheDocument();
    });
  });
});
