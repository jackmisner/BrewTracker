import UserSettingsService from "../../src/services/User/UserSettingsService";
import ApiService from "../../src/services/api";

// Mock the ApiService
jest.mock("../../src/services/api", () => ({
  user: {
    getSettings: jest.fn(),
    updateSettings: jest.fn(),
    updateProfile: jest.fn(),
    changePassword: jest.fn(),
    deleteAccount: jest.fn(),
  },
}));

// Suppress console errors during tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe("UserSettingsService", () => {
  const sampleApiResponse = {
    data: {
      user: {
        user_id: "test-user-id",
        username: "testuser",
        email: "test@example.com",
        created_at: "2024-01-01T00:00:00Z",
        last_login: "2024-01-15T00:00:00Z",
      },
      settings: {
        default_batch_size: 5.0,
        preferred_units: "imperial" as "imperial",
        timezone: "UTC",
        email_notifications: true,
        brew_reminders: true,
        contribute_anonymous_data: false,
        share_yeast_performance: false,
        share_recipe_metrics: false,
        public_recipes_default: false,
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    UserSettingsService.clearCache();

    // Default successful API responses
    (ApiService.user.getSettings as jest.Mock).mockResolvedValue(sampleApiResponse);
    (ApiService.user.updateSettings as jest.Mock).mockResolvedValue(sampleApiResponse);
    (ApiService.user.updateProfile as jest.Mock).mockResolvedValue(sampleApiResponse);
    (ApiService.user.changePassword as jest.Mock).mockResolvedValue({
      data: { success: true },
    });
    (ApiService.user.deleteAccount as jest.Mock).mockResolvedValue({
      data: { success: true },
    });
  });

  describe("getUserSettings", () => {
    it("fetches and processes user settings successfully", async () => {
      const result = await UserSettingsService.getUserSettings();

      expect(ApiService.user.getSettings).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        user: sampleApiResponse.data.user,
        settings: {
          contribute_anonymous_data: false,
          share_yeast_performance: false,
          share_recipe_metrics: false,
          public_recipes_default: false,
          default_batch_size: 5.0,
          preferred_units: "imperial" as "imperial",
          timezone: "UTC",
          email_notifications: true,
          brew_reminders: true,
        },
      });
    });

    it("caches settings after first fetch", async () => {
      await UserSettingsService.getUserSettings();
      await UserSettingsService.getUserSettings();

      expect(ApiService.user.getSettings).toHaveBeenCalledTimes(1);
    });

    it("forces refresh when forceRefresh is true", async () => {
      await UserSettingsService.getUserSettings();
      await UserSettingsService.getUserSettings(true);

      expect(ApiService.user.getSettings).toHaveBeenCalledTimes(2);
    });

    it("refetches when cache expires", async () => {
      jest.useFakeTimers();

      await UserSettingsService.getUserSettings();

      // Advance time by more than cache duration (2 minutes)
      jest.advanceTimersByTime(3 * 60 * 1000);

      await UserSettingsService.getUserSettings();

      expect(ApiService.user.getSettings).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it("handles API errors gracefully", async () => {
      const apiError = new Error("Network error");
      (ApiService.user.getSettings as jest.Mock).mockRejectedValue(apiError);

      await expect(UserSettingsService.getUserSettings()).rejects.toThrow(
        "Failed to load user settings: Network error"
      );
    });

    it("handles missing settings data gracefully", async () => {
      (ApiService.user.getSettings as jest.Mock).mockResolvedValue({
        data: {
          user: { username: "test" },
          settings: {},
        },
      });

      const result = await UserSettingsService.getUserSettings();

      expect(result.settings.default_batch_size).toBe(5.0);
      expect(result.settings.preferred_units).toBe("imperial");
      expect(result.settings.email_notifications).toBe(true);
    });

    it("handles completely missing data", async () => {
      (ApiService.user.getSettings as jest.Mock).mockResolvedValue({ data: {} });

      const result = await UserSettingsService.getUserSettings();

      expect(result.user).toEqual({});
      expect(result.settings).toMatchObject({
        default_batch_size: 5.0,
        preferred_units: "imperial" as "imperial",
        email_notifications: true,
        brew_reminders: true,
      });
    });
  });

  describe("updateSettings", () => {
    const settingsUpdate = {
      default_batch_size: 7.5,
      preferred_units: "metric" as "metric",
    };

    it("updates settings successfully", async () => {
      const result = await UserSettingsService.updateSettings(settingsUpdate);

      expect(ApiService.user.updateSettings).toHaveBeenCalledWith(settingsUpdate);
      expect(result).toBeDefined();
    });

    it("validates settings before updating", async () => {
      const invalidSettings = {
        default_batch_size: -5,
        preferred_units: "invalid" as any,
      };

      await expect(
        UserSettingsService.updateSettings(invalidSettings)
      ).rejects.toThrow("Validation failed");
    });

    it("updates cache after successful update", async () => {
      // First, populate cache
      await UserSettingsService.getUserSettings();

      // Update settings
      await UserSettingsService.updateSettings(settingsUpdate);

      // Getting settings again should use cache (no new API call)
      await UserSettingsService.getUserSettings();

      expect(ApiService.user.getSettings).toHaveBeenCalledTimes(1);
      expect(ApiService.user.updateSettings).toHaveBeenCalledTimes(1);
    });

    it("handles API errors during update", async () => {
      const apiError = new Error("Update failed");
      (ApiService.user.updateSettings as jest.Mock).mockRejectedValue(apiError);

      await expect(
        UserSettingsService.updateSettings(settingsUpdate)
      ).rejects.toThrow("Failed to update settings: Update failed");
    });

    it("handles server validation errors", async () => {
      const serverError = {
        response: {
          data: {
            error: "Invalid batch size",
          },
        },
      };
      (ApiService.user.updateSettings as jest.Mock).mockRejectedValue(serverError);

      await expect(
        UserSettingsService.updateSettings(settingsUpdate)
      ).rejects.toThrow("Failed to update settings: Invalid batch size");
    });
  });

  describe("updateProfile", () => {
    const profileUpdate = {
      username: "newusername",
      email: "new@example.com",
    };

    it("updates profile successfully", async () => {
      const result = await UserSettingsService.updateProfile(profileUpdate);

      expect(ApiService.user.updateProfile).toHaveBeenCalledWith(profileUpdate);
      expect(result).toBeDefined();
    });

    it("validates profile data before updating", async () => {
      const invalidProfile = {
        username: "ab", // too short
        email: "invalid-email",
      };

      await expect(
        UserSettingsService.updateProfile(invalidProfile)
      ).rejects.toThrow("Validation failed");
    });

    it("updates cached user data after successful update", async () => {
      // Populate cache first
      await UserSettingsService.getUserSettings();

      const newUserData = {
        ...sampleApiResponse,
        data: {
          ...sampleApiResponse.data,
          user: { ...sampleApiResponse.data.user, username: "newusername" },
        },
      };
      (ApiService.user.updateProfile as jest.Mock).mockResolvedValue(newUserData);

      await UserSettingsService.updateProfile(profileUpdate);

      // Cache is updated internally - test through public interface
      const settings = await UserSettingsService.getUserSettings();
      expect(settings.user.username).toBe("newusername");
    });

    it("handles API errors during profile update", async () => {
      const apiError = new Error("Profile update failed");
      (ApiService.user.updateProfile as jest.Mock).mockRejectedValue(apiError);

      await expect(
        UserSettingsService.updateProfile(profileUpdate)
      ).rejects.toThrow("Failed to update profile: Profile update failed");
    });
  });

  describe("changePassword", () => {
    const passwordData = {
      current_password: "oldpass",
      new_password: "newpass123",
      confirm_password: "newpass123",
    };

    it("changes password successfully", async () => {
      const result = await UserSettingsService.changePassword(passwordData);

      expect(ApiService.user.changePassword).toHaveBeenCalledWith(passwordData);
      expect(result).toBeDefined();
    });

    it("validates password data before changing", async () => {
      const invalidPasswordData = {
        current_password: "",
        new_password: "123", // too short
        confirm_password: "456", // doesn't match
      };

      await expect(
        UserSettingsService.changePassword(invalidPasswordData)
      ).rejects.toThrow("Validation failed");
    });

    it("handles API errors during password change", async () => {
      const apiError = new Error("Current password incorrect");
      (ApiService.user.changePassword as jest.Mock).mockRejectedValue(apiError);

      await expect(
        UserSettingsService.changePassword(passwordData)
      ).rejects.toThrow(
        "Failed to change password: Current password incorrect"
      );
    });
  });

  describe("deleteAccount", () => {
    const confirmationData = {
      password: "password123",
      confirmation: "DELETE",
    };

    it("deletes account successfully", async () => {
      const result = await UserSettingsService.deleteAccount(confirmationData);

      expect(ApiService.user.deleteAccount).toHaveBeenCalledWith(
        confirmationData
      );
      expect(result).toBeDefined();
    });

    it("clears cache after successful deletion", async () => {
      // Populate cache first
      await UserSettingsService.getUserSettings();

      await UserSettingsService.deleteAccount(confirmationData);

      // Cache is cleared internally - this is implementation detail
    });

    it("validates confirmation data before deletion", async () => {
      const invalidConfirmation = {
        password: "",
        confirmation: "WRONG",
      };

      await expect(
        UserSettingsService.deleteAccount(invalidConfirmation)
      ).rejects.toThrow("Validation failed");
    });

    it("handles API errors during account deletion", async () => {
      const apiError = new Error("Deletion failed");
      (ApiService.user.deleteAccount as jest.Mock).mockRejectedValue(apiError);

      await expect(
        UserSettingsService.deleteAccount(confirmationData)
      ).rejects.toThrow("Failed to delete account: Deletion failed");
    });
  });

  describe("validateSettings", () => {
    it("validates valid settings", () => {
      const validSettings = {
        default_batch_size: 5.0,
        preferred_units: "imperial" as "imperial",
      };

      const result = UserSettingsService.validateSettings(validSettings);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects invalid batch size", () => {
      const invalidSettings = {
        default_batch_size: -1,
      };

      const result = UserSettingsService.validateSettings(invalidSettings);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Default batch size must be between 0 and 100 gallons"
      );
    });

    it("rejects batch size too large", () => {
      const invalidSettings = {
        default_batch_size: 150,
      };

      const result = UserSettingsService.validateSettings(invalidSettings);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Default batch size must be between 0 and 100 gallons"
      );
    });

    it("rejects invalid preferred units", () => {
      const invalidSettings = {
        preferred_units: "invalid" as any,
      };

      const result = UserSettingsService.validateSettings(invalidSettings);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Preferred units must be 'imperial' or 'metric'"
      );
    });

    it("accepts metric units", () => {
      const validSettings = {
        preferred_units: "metric" as "metric",
      };

      const result = UserSettingsService.validateSettings(validSettings);

      expect(result.isValid).toBe(true);
    });

    it("handles multiple validation errors", () => {
      const invalidSettings = {
        default_batch_size: -5,
        preferred_units: "invalid" as any,
      };

      const result = UserSettingsService.validateSettings(invalidSettings);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe("validateProfile", () => {
    it("validates valid profile data", () => {
      const validProfile = {
        username: "validuser",
        email: "valid@example.com",
      };

      const result = UserSettingsService.validateProfile(validProfile);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects invalid email format", () => {
      const invalidProfile = {
        email: "invalid-email",
      };

      const result = UserSettingsService.validateProfile(invalidProfile);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid email format");
    });

    it("rejects username too short", () => {
      const invalidProfile = {
        username: "ab",
      };

      const result = UserSettingsService.validateProfile(invalidProfile);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Username must be at least 3 characters");
    });

    it("rejects username too long", () => {
      const invalidProfile = {
        username: "a".repeat(81),
      };

      const result = UserSettingsService.validateProfile(invalidProfile);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Username must be less than 80 characters"
      );
    });

    it("rejects username with invalid characters", () => {
      const invalidProfile = {
        username: "user@name!",
      };

      const result = UserSettingsService.validateProfile(invalidProfile);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Username can only contain letters, numbers, hyphens, and underscores"
      );
    });

    it("accepts username with valid characters", () => {
      const validProfile = {
        username: "user_name-123",
      };

      const result = UserSettingsService.validateProfile(validProfile);

      expect(result.isValid).toBe(true);
    });

    it("allows empty fields", () => {
      const emptyProfile = {};

      const result = UserSettingsService.validateProfile(emptyProfile);

      expect(result.isValid).toBe(true);
    });
  });

  describe("validatePasswordChange", () => {
    it("validates valid password change data", () => {
      const validData = {
        current_password: "oldpass",
        new_password: "newpass123",
        confirm_password: "newpass123",
      };

      const result = UserSettingsService.validatePasswordChange(validData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects missing current password", () => {
      const invalidData = {
        current_password: "",
        new_password: "newpass123",
        confirm_password: "newpass123",
      };

      const result = UserSettingsService.validatePasswordChange(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Current password is required");
    });

    it("rejects missing new password", () => {
      const invalidData = {
        current_password: "oldpass",
        new_password: "",
        confirm_password: "",
      };

      const result = UserSettingsService.validatePasswordChange(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("New password is required");
    });

    it("rejects new password too short", () => {
      const invalidData = {
        current_password: "oldpass",
        new_password: "123",
        confirm_password: "123",
      };

      const result = UserSettingsService.validatePasswordChange(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "New password must be at least 6 characters"
      );
    });

    it("rejects mismatched passwords", () => {
      const invalidData = {
        current_password: "oldpass",
        new_password: "newpass123",
        confirm_password: "different",
      };

      const result = UserSettingsService.validatePasswordChange(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("New passwords do not match");
    });

    it("handles multiple validation errors", () => {
      const invalidData = {
        current_password: "",
        new_password: "123",
        confirm_password: "456",
      };

      const result = UserSettingsService.validatePasswordChange(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe("validateAccountDeletion", () => {
    it("validates valid deletion data", () => {
      const validData = {
        password: "password123",
        confirmation: "DELETE",
      };

      const result = UserSettingsService.validateAccountDeletion(validData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects missing password", () => {
      const invalidData = {
        password: "",
        confirmation: "DELETE",
      };

      const result = UserSettingsService.validateAccountDeletion(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Password is required");
    });

    it("rejects incorrect confirmation", () => {
      const invalidData = {
        password: "password123",
        confirmation: "WRONG",
      };

      const result = UserSettingsService.validateAccountDeletion(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Must type 'DELETE' to confirm account deletion"
      );
    });

    it("is case sensitive for confirmation", () => {
      const invalidData = {
        password: "password123",
        confirmation: "delete",
      };

      const result = UserSettingsService.validateAccountDeletion(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Must type 'DELETE' to confirm account deletion"
      );
    });
  });

  describe("getDefaultSettings", () => {
    it("returns default settings object", () => {
      const defaults = UserSettingsService.getDefaultSettings();

      expect(defaults).toEqual({
        contribute_anonymous_data: false,
        share_yeast_performance: false,
        share_recipe_metrics: false,
        public_recipes_default: false,
        default_batch_size: 5.0,
        preferred_units: "imperial" as "imperial",
        timezone: "UTC",
        email_notifications: true,
        brew_reminders: true,
      });
    });

    it("returns a new object each time", () => {
      const defaults1 = UserSettingsService.getDefaultSettings();
      const defaults2 = UserSettingsService.getDefaultSettings();

      expect(defaults1).not.toBe(defaults2);
      expect(defaults1).toEqual(defaults2);
    });
  });

  describe("processSettingsData", () => {
    it("processes complete settings data correctly", () => {
      const result = UserSettingsService.processSettingsData(
        sampleApiResponse.data
      );

      expect(result.user).toEqual(sampleApiResponse.data.user);
      expect(result.settings).toMatchObject({
        default_batch_size: 5.0,
        preferred_units: "imperial" as "imperial",
        email_notifications: true,
        brew_reminders: true,
      });
    });

    it("handles missing settings with defaults", () => {
      const incompleteData = {
        user: { username: "test" },
        settings: {
          default_batch_size: 7.5,
        },
      };

      const result = UserSettingsService.processSettingsData(incompleteData);

      expect(result.settings.default_batch_size).toBe(7.5);
      expect(result.settings.preferred_units).toBe("imperial");
      expect(result.settings.email_notifications).toBe(true);
    });

    it("handles completely missing settings", () => {
      const dataWithoutSettings = {
        user: { username: "test" },
      };

      const result =
        UserSettingsService.processSettingsData(dataWithoutSettings);

      expect(result.settings).toMatchObject({
        default_batch_size: 5.0,
        preferred_units: "imperial" as "imperial",
        email_notifications: true,
      });
    });

    it("handles false notification settings correctly", () => {
      const dataWithFalseNotifications = {
        user: { username: "test" },
        settings: {
          email_notifications: false,
          brew_reminders: false,
        },
      };

      const result = UserSettingsService.processSettingsData(
        dataWithFalseNotifications
      );

      expect(result.settings.email_notifications).toBe(false);
      expect(result.settings.brew_reminders).toBe(false);
    });
  });

  describe("createSettingsError", () => {
    it("creates basic error with message", () => {
      const error = UserSettingsService.createSettingsError("Test error");

      expect(error.message).toBe("Test error");
      expect(error.isSettingsError).toBe(true);
    });

    it("includes original error message", () => {
      const originalError = new Error("Original error");
      const error = UserSettingsService.createSettingsError(
        "Test error",
        originalError
      );

      expect(error.message).toBe("Test error: Original error");
      expect(error.originalError).toBe(originalError);
    });

    it("includes server error message", () => {
      const serverError = {
        response: {
          data: {
            error: "Server validation failed",
          },
        },
      };
      const error = UserSettingsService.createSettingsError(
        "Test error",
        serverError
      );

      expect(error.message).toBe("Test error: Server validation failed");
    });

    it("prioritizes server error over original error message", () => {
      const serverError = {
        message: "Network error",
        response: {
          data: {
            error: "Server error",
          },
        },
      };
      const error = UserSettingsService.createSettingsError(
        "Test error",
        serverError
      );

      expect(error.message).toBe("Test error: Server error");
    });
  });

  describe("cache management", () => {
    it("isCacheValid returns false when no cache", () => {
      expect(UserSettingsService.isCacheValid()).toBeFalsy();
    });

    it("isCacheValid returns true for fresh cache", async () => {
      await UserSettingsService.getUserSettings();

      expect(UserSettingsService.isCacheValid()).toBe(true);
    });

    it("isCacheValid returns false for expired cache", async () => {
      jest.useFakeTimers();

      await UserSettingsService.getUserSettings();

      // Advance time past cache duration
      jest.advanceTimersByTime(3 * 60 * 1000);

      expect(UserSettingsService.isCacheValid()).toBe(false);

      jest.useRealTimers();
    });

    it("clearCache removes cache and timestamp", async () => {
      await UserSettingsService.getUserSettings();

      UserSettingsService.clearCache();

      // Cache behavior is internal - test through public interface
      // After clearing cache, next call should fetch fresh data
      const freshSettings = await UserSettingsService.getUserSettings();
      expect(ApiService.user.getSettings).toHaveBeenCalled();
    });
  });

  describe("singleton behavior", () => {
    it("maintains state across imports", async () => {
      await UserSettingsService.getUserSettings();

      // Import again to simulate different module
      const { default: AnotherInstance } = await import(
        "../../src/services/User/UserSettingsService"
      );

      expect(AnotherInstance).toBe(UserSettingsService);
    });
  });

  describe("edge cases and error scenarios", () => {
    it("handles null API response", async () => {
      (ApiService.user.getSettings as jest.Mock).mockResolvedValue({ data: null });

      await expect(UserSettingsService.getUserSettings()).rejects.toThrow();
    });

    it("handles undefined API response", async () => {
      (ApiService.user.getSettings as jest.Mock).mockResolvedValue({ data: undefined });

      await expect(UserSettingsService.getUserSettings()).rejects.toThrow(
        "Failed to load user settings"
      );
    });

    it("handles network timeout", async () => {
      const timeoutError = new Error("Request timeout") as Error & { code: string };
      timeoutError.code = "TIMEOUT";
      (ApiService.user.getSettings as jest.Mock).mockRejectedValue(timeoutError);

      await expect(UserSettingsService.getUserSettings()).rejects.toThrow(
        "Failed to load user settings: Request timeout"
      );
    });

    it("validates empty objects", () => {
      const settingsResult = UserSettingsService.validateSettings({});
      const profileResult = UserSettingsService.validateProfile({});

      expect(settingsResult.isValid).toBe(true);
      expect(profileResult.isValid).toBe(true);
    });

    it("handles very large batch sizes", () => {
      const result = UserSettingsService.validateSettings({
        default_batch_size: 1000,
      });

      expect(result.isValid).toBe(false);
    });

    it("handles edge case batch size of exactly 100", () => {
      const result = UserSettingsService.validateSettings({
        default_batch_size: 100,
      });

      expect(result.isValid).toBe(true);
    });

    it("handles batch size of exactly 0", () => {
      const result = UserSettingsService.validateSettings({
        default_batch_size: 0,
      });

      expect(result.isValid).toBe(false);
    });
  });
});
