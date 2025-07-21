import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useBlocker } from "react-router";
import { useUnits } from "../contexts/UnitContext";
import { Services } from "../services";
import { UserSettings as UserSettingsType } from "../types";
import "../styles/UserSettings.css";

type TabId = "account" | "preferences" | "privacy" | "security";

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

// Use the FullUserSettings type from the service
type FullUserSettings = Awaited<
  ReturnType<typeof Services.userSettings.getUserSettings>
>;

interface SettingsUpdateData extends Partial<UserSettingsType> {}

interface ProfileForm {
  username: string;
  email: string;
}

interface PasswordForm {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

interface DeleteForm {
  password: string;
  confirmation: string;
}

interface PreferencesForm {
  default_batch_size: number;
  preferred_units: "imperial" | "metric";
  timezone: string;
  email_notifications: boolean;
  brew_reminders: boolean;
}

interface PrivacyForm {
  contribute_anonymous_data: boolean;
  share_yeast_performance: boolean;
  share_recipe_metrics: boolean;
  public_recipes_default: boolean;
}

const UserSettings: React.FC = () => {
  const navigate = useNavigate();
  const { updateUnitSystem } = useUnits();

  const [activeTab, setActiveTab] = useState<TabId>("account");
  const [settings, setSettings] = useState<FullUserSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Form states
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    username: "",
    email: "",
  });

  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [deleteForm, setDeleteForm] = useState<DeleteForm>({
    password: "",
    confirmation: "",
  });

  const [preferencesForm, setPreferencesForm] = useState<PreferencesForm>({
    default_batch_size: 5.0,
    preferred_units: "imperial" as const,
    timezone: "UTC",
    email_notifications: true,
    brew_reminders: true,
  });

  const [privacyForm, setPrivacyForm] = useState<PrivacyForm>({
    contribute_anonymous_data: false,
    share_yeast_performance: false,
    share_recipe_metrics: false,
    public_recipes_default: false,
  });

  // Track original form values for comparison
  const [originalProfileForm, setOriginalProfileForm] = useState<ProfileForm>({
    username: "",
    email: "",
  });
  const [originalPreferencesForm, setOriginalPreferencesForm] =
    useState<PreferencesForm>({
      default_batch_size: 5.0,
      preferred_units: "imperial" as const,
      timezone: "UTC",
      email_notifications: true,
      brew_reminders: true,
    });
  const [originalPrivacyForm, setOriginalPrivacyForm] = useState<PrivacyForm>({
    contribute_anonymous_data: false,
    share_yeast_performance: false,
    share_recipe_metrics: false,
    public_recipes_default: false,
  });

  // Load user settings on mount
  useEffect(() => {
    const loadSettings = async (): Promise<void> => {
      try {
        setLoading(true);
        const userSettings = await Services.userSettings.getUserSettings();
        setSettings(userSettings);

        // Populate forms
        const profileData = {
          username: userSettings.user.username || "",
          email: userSettings.user.email || "",
        };
        const preferencesData = {
          default_batch_size: userSettings.settings.default_batch_size || 5.0,
          preferred_units:
            (userSettings.settings.preferred_units as "imperial" | "metric") ||
            "imperial",
          timezone: userSettings.settings.timezone || "UTC",
          email_notifications:
            userSettings.settings.email_notifications !== false,
          brew_reminders: userSettings.settings.brew_reminders !== false,
        };
        const privacyData = {
          contribute_anonymous_data:
            userSettings.settings.contribute_anonymous_data || false,
          share_yeast_performance:
            userSettings.settings.share_yeast_performance || false,
          share_recipe_metrics:
            userSettings.settings.share_recipe_metrics || false,
          public_recipes_default:
            userSettings.settings.public_recipes_default || false,
        };

        setProfileForm(profileData);
        setPreferencesForm(preferencesData);
        setPrivacyForm(privacyData);

        // Store original values for comparison
        setOriginalProfileForm(profileData);
        setOriginalPreferencesForm(preferencesData);
        setOriginalPrivacyForm(privacyData);
      } catch (err: any) {
        console.error("Error loading settings:", err);
        setError("Failed to load user settings");
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Check for unsaved changes
  const checkForUnsavedChanges = useCallback(() => {
    const profileChanged =
      JSON.stringify(profileForm) !== JSON.stringify(originalProfileForm);
    const preferencesChanged =
      JSON.stringify(preferencesForm) !==
      JSON.stringify(originalPreferencesForm);
    const privacyChanged =
      JSON.stringify(privacyForm) !== JSON.stringify(originalPrivacyForm);

    const hasChanges = profileChanged || preferencesChanged || privacyChanged;
    setHasUnsavedChanges(hasChanges);
    return hasChanges;
  }, [
    profileForm,
    originalProfileForm,
    preferencesForm,
    originalPreferencesForm,
    privacyForm,
    originalPrivacyForm,
  ]);

  // Update unsaved changes when forms change
  useEffect(() => {
    checkForUnsavedChanges();
  }, [checkForUnsavedChanges]);

  // Clear messages after a delay
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(""), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [successMessage]);

  const handleProfileSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");

      await Services.userSettings.updateProfile(profileForm);
      setOriginalProfileForm({ ...profileForm }); // Update original to match saved state
      setSuccessMessage("Profile updated successfully");
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");

      await Services.userSettings.changePassword(passwordForm);
      setSuccessMessage("Password changed successfully");
      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
    } catch (err: any) {
      setError(err.message || "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  const handlePreferencesSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");

      // Update preferences using the settings service
      await Services.userSettings.updateSettings(
        preferencesForm as SettingsUpdateData
      );

      // Update the global unit context with the new preferred units
      await updateUnitSystem(
        preferencesForm.preferred_units as "imperial" | "metric"
      );

      setOriginalPreferencesForm({ ...preferencesForm }); // Update original to match saved state
      setSuccessMessage("Preferences updated successfully");
    } catch (err: any) {
      setError(err.message || "Failed to update preferences");
    } finally {
      setSaving(false);
    }
  };

  const handlePrivacySubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");

      await Services.userSettings.updateSettings(privacyForm);
      setOriginalPrivacyForm({ ...privacyForm }); // Update original to match saved state
      setSuccessMessage("Privacy settings updated successfully");
    } catch (err: any) {
      setError(err.message || "Failed to update privacy settings");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    if (
      !window.confirm(
        "Are you absolutely sure you want to delete your account? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      await Services.userSettings.deleteAccount(deleteForm);
      // Logout and redirect
      localStorage.removeItem("token");
      window.dispatchEvent(new Event("authChange"));
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Failed to delete account");
      setSaving(false);
    }
  };

  // Handle unit system change with default batch size
  const handleUnitSystemChange = (
    newUnitSystem: "imperial" | "metric"
  ): void => {
    const defaultBatchSize = newUnitSystem === "metric" ? 19 : 5;

    setPreferencesForm((prev) => ({
      ...prev,
      preferred_units: newUnitSystem,
      default_batch_size: defaultBatchSize,
    }));
  };

  // Block navigation when there are unsaved changes
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname
  );

  // Handle browser beforeunload event
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue =
          "You have unsaved changes. Are you sure you want to leave?";
        return "You have unsaved changes. Are you sure you want to leave?";
      }
      return undefined;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  if (loading) {
    return <div className="loading-message">Loading settings...</div>;
  }

  const tabs: Tab[] = [
    { id: "account", label: "Account", icon: "👤" },
    { id: "preferences", label: "Preferences", icon: "⚙️" },
    { id: "privacy", label: "Privacy", icon: "🔒" },
    { id: "security", label: "Security", icon: "🛡️" },
  ];

  return (
    <>
      {/* Navigation blocking dialog */}
      {blocker.state === "blocked" && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Unsaved Changes</h3>
            <p>
              You have unsaved changes that will be lost. Are you sure you want
              to leave this page?
            </p>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => blocker.reset?.()}
              >
                Stay on Page
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  setHasUnsavedChanges(false);
                  blocker.proceed?.();
                }}
              >
                Leave Without Saving
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="settings-container">
        <div className="settings-header">
          <h1 className="settings-title">Account Settings</h1>
          <p className="settings-subtitle">
            Manage your account and preferences
          </p>
        </div>

        {error && (
          <div className="error-banner">
            <div className="error-content">
              <span className="error-icon">⚠️</span>
              <span className="error-message">{error}</span>
              <button onClick={() => setError("")} className="error-dismiss">
                ×
              </button>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="success-banner">
            <div className="success-content">
              <span className="success-icon">✅</span>
              <span className="success-message">{successMessage}</span>
              <button
                onClick={() => setSuccessMessage("")}
                className="success-dismiss"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <div className="settings-layout">
          {/* Tab Navigation */}
          <div className="settings-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`settings-tab ${
                  activeTab === tab.id ? "active" : ""
                }`}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="settings-content">
            {activeTab === "account" && (
              <div className="settings-section">
                <h2 className="section-title">Account Information</h2>
                <form onSubmit={handleProfileSubmit} className="settings-form">
                  <div className="form-group">
                    <label htmlFor="username" className="form-label">
                      Username
                    </label>
                    <input
                      type="text"
                      id="username"
                      value={profileForm.username}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          username: e.target.value,
                        })
                      }
                      className="form-control"
                      disabled={saving}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="email" className="form-label">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={profileForm.email}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          email: e.target.value,
                        })
                      }
                      className="form-control"
                      disabled={saving}
                      required
                    />
                  </div>

                  <div className="form-actions">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={saving}
                    >
                      {saving ? "Saving..." : "Update Profile"}
                    </button>
                  </div>
                </form>

                {settings && (
                  <div className="account-info">
                    <h3 className="subsection-title">Account Details</h3>
                    <div className="info-grid">
                      <div className="info-item">
                        <span className="info-label">Member Since:</span>
                        <span className="info-value">
                          {new Date(
                            settings.user.created_at || ""
                          ).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Last Login:</span>
                        <span className="info-value">
                          {settings.user.last_login
                            ? new Date(
                                settings.user.last_login
                              ).toLocaleDateString()
                            : "Never"}
                        </span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Account Status:</span>
                        <span className="info-value">
                          <span className="status-badge active">Active</span>
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "preferences" && (
              <div className="settings-section">
                <h2 className="section-title">Application Preferences</h2>

                <form
                  onSubmit={handlePreferencesSubmit}
                  className="settings-form"
                >
                  {/* Unit System Selection */}
                  <div className="form-group">
                    <label className="form-label">Unit System</label>
                    <p className="form-help-text">
                      Choose your preferred unit system. This affects all
                      measurements throughout the app.
                    </p>
                    <div className="unit-toggle-container">
                      <button
                        type="button"
                        onClick={() => handleUnitSystemChange("imperial")}
                        className={`unit-toggle-button ${
                          preferencesForm.preferred_units === "imperial"
                            ? "active"
                            : ""
                        }`}
                        disabled={saving}
                      >
                        <span className="unit-toggle-icon">🇺🇸</span>
                        <div className="unit-toggle-content">
                          <div className="unit-toggle-title">Imperial</div>
                          <div className="unit-toggle-description">
                            Gallons, °F, lb, oz
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUnitSystemChange("metric")}
                        className={`unit-toggle-button ${
                          preferencesForm.preferred_units === "metric"
                            ? "active"
                            : ""
                        }`}
                        disabled={saving}
                      >
                        <span className="unit-toggle-icon">🌍</span>
                        <div className="unit-toggle-content">
                          <div className="unit-toggle-title">Metric</div>
                          <div className="unit-toggle-description">
                            Liters, °C, kg, g
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="default_batch_size" className="form-label">
                      Default Batch Size (
                      {preferencesForm.preferred_units === "metric"
                        ? "liters"
                        : "gallons"}
                      )
                    </label>
                    <input
                      type="number"
                      id="default_batch_size"
                      step="0.5"
                      min="0.5"
                      max="100"
                      value={preferencesForm.default_batch_size}
                      onChange={(e) =>
                        setPreferencesForm({
                          ...preferencesForm,
                          default_batch_size: parseFloat(e.target.value),
                        })
                      }
                      className="form-control"
                      disabled={saving}
                    />
                    <small className="form-help-text">
                      {preferencesForm.preferred_units === "metric"
                        ? "Typical homebrew batch: 19-23 liters"
                        : "Typical homebrew batch: 5 gallons"}
                    </small>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Notifications</label>
                    <div className="checkbox-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={preferencesForm.email_notifications}
                          onChange={(e) =>
                            setPreferencesForm({
                              ...preferencesForm,
                              email_notifications: e.target.checked,
                            })
                          }
                          disabled={saving}
                        />
                        Email notifications
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={preferencesForm.brew_reminders}
                          onChange={(e) =>
                            setPreferencesForm({
                              ...preferencesForm,
                              brew_reminders: e.target.checked,
                            })
                          }
                          disabled={saving}
                        />
                        Brewing reminders
                      </label>
                    </div>
                  </div>

                  <div className="form-actions">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={saving}
                    >
                      {saving ? "Saving..." : "Save Preferences"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === "privacy" && (
              <div className="settings-section">
                <h2 className="section-title">Privacy Settings</h2>
                <p className="section-description">
                  Control how your brewing data is shared to help improve the
                  platform.
                </p>

                <form onSubmit={handlePrivacySubmit} className="settings-form">
                  <div className="privacy-section">
                    <h3 className="subsection-title">Data Sharing</h3>
                    <div className="checkbox-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={privacyForm.contribute_anonymous_data}
                          onChange={(e) =>
                            setPrivacyForm({
                              ...privacyForm,
                              contribute_anonymous_data: e.target.checked,
                            })
                          }
                          disabled={saving}
                        />
                        <div className="checkbox-content">
                          <span className="checkbox-title">
                            Contribute Anonymous Brewing Data
                          </span>
                          <span className="checkbox-description">
                            Help improve recipe predictions by sharing
                            anonymized brewing results. No personal information
                            is shared.
                          </span>
                        </div>
                      </label>

                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={privacyForm.share_yeast_performance}
                          onChange={(e) =>
                            setPrivacyForm({
                              ...privacyForm,
                              share_yeast_performance: e.target.checked,
                            })
                          }
                          disabled={saving}
                        />
                        <div className="checkbox-content">
                          <span className="checkbox-title">
                            Share Yeast Performance Data
                          </span>
                          <span className="checkbox-description">
                            Share anonymized yeast attenuation data to improve
                            yeast performance predictions for all users.
                          </span>
                        </div>
                      </label>

                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={privacyForm.share_recipe_metrics}
                          onChange={(e) =>
                            setPrivacyForm({
                              ...privacyForm,
                              share_recipe_metrics: e.target.checked,
                            })
                          }
                          disabled={saving}
                        />
                        <div className="checkbox-content">
                          <span className="checkbox-title">
                            Share Recipe Metrics
                          </span>
                          <span className="checkbox-description">
                            Contribute recipe outcome data to help improve
                            brewing calculations and style guidelines.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="privacy-section">
                    <h3 className="subsection-title">Public Visibility</h3>
                    <div className="checkbox-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={privacyForm.public_recipes_default}
                          onChange={(e) =>
                            setPrivacyForm({
                              ...privacyForm,
                              public_recipes_default: e.target.checked,
                            })
                          }
                          disabled={saving}
                        />
                        <div className="checkbox-content">
                          <span className="checkbox-title">
                            Make New Recipes Public by Default
                          </span>
                          <span className="checkbox-description">
                            New recipes will be visible to other users by
                            default. You can always change this for individual
                            recipes.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="form-actions">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={saving}
                    >
                      {saving ? "Saving..." : "Save Privacy Settings"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === "security" && (
              <div className="settings-section">
                <h2 className="section-title">Security</h2>

                {/* Password Change */}
                <div className="security-section">
                  <h3 className="subsection-title">Change Password</h3>
                  <form
                    onSubmit={handlePasswordSubmit}
                    className="settings-form"
                  >
                    <div className="form-group">
                      <label htmlFor="current_password" className="form-label">
                        Current Password
                      </label>
                      <input
                        type="password"
                        id="current_password"
                        value={passwordForm.current_password}
                        onChange={(e) =>
                          setPasswordForm({
                            ...passwordForm,
                            current_password: e.target.value,
                          })
                        }
                        className="form-control"
                        disabled={saving}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="new_password" className="form-label">
                        New Password
                      </label>
                      <input
                        type="password"
                        id="new_password"
                        value={passwordForm.new_password}
                        onChange={(e) =>
                          setPasswordForm({
                            ...passwordForm,
                            new_password: e.target.value,
                          })
                        }
                        className="form-control"
                        disabled={saving}
                        minLength={6}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="confirm_password" className="form-label">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        id="confirm_password"
                        value={passwordForm.confirm_password}
                        onChange={(e) =>
                          setPasswordForm({
                            ...passwordForm,
                            confirm_password: e.target.value,
                          })
                        }
                        className="form-control"
                        disabled={saving}
                        required
                      />
                    </div>

                    <div className="form-actions">
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={saving}
                      >
                        {saving ? "Changing..." : "Change Password"}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Account Deletion */}
                <div className="security-section danger-zone">
                  <h3 className="subsection-title">Danger Zone</h3>
                  <div className="danger-warning">
                    <p>
                      <strong>Warning:</strong> Account deletion is permanent
                      and cannot be undone. All your recipes, brew sessions, and
                      data will be lost.
                    </p>
                  </div>

                  <form
                    onSubmit={handleDeleteAccount}
                    className="settings-form"
                  >
                    <div className="form-group">
                      <label htmlFor="delete_password" className="form-label">
                        Enter your password to confirm
                      </label>
                      <input
                        type="password"
                        id="delete_password"
                        value={deleteForm.password}
                        onChange={(e) =>
                          setDeleteForm({
                            ...deleteForm,
                            password: e.target.value,
                          })
                        }
                        className="form-control"
                        disabled={saving}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label
                        htmlFor="delete_confirmation"
                        className="form-label"
                      >
                        Type "DELETE" to confirm
                      </label>
                      <input
                        type="text"
                        id="delete_confirmation"
                        value={deleteForm.confirmation}
                        onChange={(e) =>
                          setDeleteForm({
                            ...deleteForm,
                            confirmation: e.target.value,
                          })
                        }
                        className="form-control"
                        disabled={saving}
                        placeholder="DELETE"
                        required
                      />
                    </div>

                    <div className="form-actions">
                      <button
                        type="submit"
                        className="btn btn-danger"
                        disabled={
                          saving || deleteForm.confirmation !== "DELETE"
                        }
                      >
                        {saving ? "Deleting..." : "Delete Account"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default UserSettings;
