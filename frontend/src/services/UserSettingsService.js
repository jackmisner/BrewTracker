import ApiService from "./api";

/**
 * Service class for managing user settings and account management
 */
class UserSettingsService {
  constructor() {
    this.settingsCache = null;
    this.cacheTimestamp = null;
    this.CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
  }

  /**
   * Get current user settings
   */
  async getUserSettings(forceRefresh = false) {
    // Check cache first
    if (!forceRefresh && this.settingsCache && this.isCacheValid()) {
      return this.settingsCache;
    }

    try {
      const response = await ApiService.user.getSettings();
      const settings = this.processSettingsData(response.data);

      // Update cache
      this.settingsCache = settings;
      this.cacheTimestamp = Date.now();

      return settings;
    } catch (error) {
      console.error("Error fetching user settings:", error);
      throw this.createSettingsError("Failed to load user settings", error);
    }
  }

  /**
   * Update user settings
   */
  async updateSettings(settingsData) {
    try {
      const validation = this.validateSettings(settingsData);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
      }

      const response = await ApiService.user.updateSettings({
        settings: settingsData,
      });

      // Update cache
      this.settingsCache = this.processSettingsData(response.data);
      this.cacheTimestamp = Date.now();

      return this.settingsCache;
    } catch (error) {
      console.error("Error updating settings:", error);
      throw this.createSettingsError("Failed to update settings", error);
    }
  }

  /**
   * Update user profile (username, email)
   */
  async updateProfile(profileData) {
    try {
      const validation = this.validateProfile(profileData);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
      }

      const response = await ApiService.user.updateProfile(profileData);

      // Update cache
      if (this.settingsCache) {
        this.settingsCache.user = response.data.user;
      }

      return response.data;
    } catch (error) {
      console.error("Error updating profile:", error);
      throw this.createSettingsError("Failed to update profile", error);
    }
  }

  /**
   * Change user password
   */
  async changePassword(passwordData) {
    try {
      const validation = this.validatePasswordChange(passwordData);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
      }

      const response = await ApiService.user.changePassword(passwordData);
      return response.data;
    } catch (error) {
      console.error("Error changing password:", error);
      throw this.createSettingsError("Failed to change password", error);
    }
  }

  /**
   * Delete user account
   */
  async deleteAccount(confirmationData) {
    try {
      const validation = this.validateAccountDeletion(confirmationData);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
      }

      const response = await ApiService.user.deleteAccount(confirmationData);

      // Clear cache and logout
      this.clearCache();

      return response.data;
    } catch (error) {
      console.error("Error deleting account:", error);
      throw this.createSettingsError("Failed to delete account", error);
    }
  }

  // ===== VALIDATION METHODS =====

  /**
   * Validate settings data
   */
  validateSettings(settingsData) {
    const errors = [];

    if (
      settingsData.default_batch_size !== undefined &&
      (settingsData.default_batch_size <= 0 ||
        settingsData.default_batch_size > 100)
    ) {
      errors.push("Default batch size must be between 0 and 100 gallons");
    }

    if (
      settingsData.preferred_units &&
      !["imperial", "metric"].includes(settingsData.preferred_units)
    ) {
      errors.push("Preferred units must be 'imperial' or 'metric'");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate profile data
   */
  validateProfile(profileData) {
    const errors = [];

    if (profileData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(profileData.email)) {
        errors.push("Invalid email format");
      }
    }

    if (profileData.username) {
      if (profileData.username.length < 3) {
        errors.push("Username must be at least 3 characters");
      }
      if (profileData.username.length > 80) {
        errors.push("Username must be less than 80 characters");
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(profileData.username)) {
        errors.push(
          "Username can only contain letters, numbers, hyphens, and underscores"
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate password change data
   */
  validatePasswordChange(passwordData) {
    const errors = [];

    if (!passwordData.current_password) {
      errors.push("Current password is required");
    }

    if (!passwordData.new_password) {
      errors.push("New password is required");
    }

    if (passwordData.new_password && passwordData.new_password.length < 6) {
      errors.push("New password must be at least 6 characters");
    }

    if (
      passwordData.new_password &&
      passwordData.confirm_password &&
      passwordData.new_password !== passwordData.confirm_password
    ) {
      errors.push("New passwords do not match");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate account deletion data
   */
  validateAccountDeletion(confirmationData) {
    const errors = [];

    if (!confirmationData.password) {
      errors.push("Password is required");
    }

    if (confirmationData.confirmation !== "DELETE") {
      errors.push("Must type 'DELETE' to confirm account deletion");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // ===== UTILITY METHODS =====

  /**
   * Process settings data from API response
   */
  processSettingsData(rawData) {
    return {
      user: rawData.user || {},
      settings: {
        // Privacy settings
        contribute_anonymous_data:
          rawData.settings?.contribute_anonymous_data || false,
        share_yeast_performance:
          rawData.settings?.share_yeast_performance || false,
        share_recipe_metrics: rawData.settings?.share_recipe_metrics || false,
        public_recipes_default:
          rawData.settings?.public_recipes_default || false,

        // Application preferences
        default_batch_size: rawData.settings?.default_batch_size || 5.0,
        preferred_units: rawData.settings?.preferred_units || "imperial",
        timezone: rawData.settings?.timezone || "UTC",

        // Notification preferences
        email_notifications: rawData.settings?.email_notifications !== false,
        brew_reminders: rawData.settings?.brew_reminders !== false,
      },
    };
  }

  /**
   * Get default settings
   */
  getDefaultSettings() {
    return {
      contribute_anonymous_data: false,
      share_yeast_performance: false,
      share_recipe_metrics: false,
      public_recipes_default: false,
      default_batch_size: 5.0,
      preferred_units: "imperial",
      timezone: "UTC",
      email_notifications: true,
      brew_reminders: true,
    };
  }

  /**
   * Create standardized settings error
   */
  createSettingsError(message, originalError) {
    const error = new Error(message);
    error.originalError = originalError;
    error.isSettingsError = true;

    if (originalError?.response?.data?.error) {
      error.message = `${message}: ${originalError.response.data.error}`;
    } else if (originalError?.message) {
      error.message = `${message}: ${originalError.message}`;
    }

    return error;
  }

  /**
   * Check if cache is valid
   */
  isCacheValid() {
    return (
      this.cacheTimestamp &&
      Date.now() - this.cacheTimestamp < this.CACHE_DURATION
    );
  }

  /**
   * Clear settings cache
   */
  clearCache() {
    this.settingsCache = null;
    this.cacheTimestamp = null;
  }
}

// Export as singleton
const userSettingsServiceInstance = new UserSettingsService();
export default userSettingsServiceInstance;
