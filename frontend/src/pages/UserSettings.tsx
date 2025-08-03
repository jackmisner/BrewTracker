import React, { useReducer, useEffect, useCallback } from "react";
import { useNavigate, useBlocker } from "react-router";
import { useUnits } from "../contexts/UnitContext";
import { Services } from "../services";
import { UserSettings as UserSettingsType } from "../types";
import {
  userSettingsReducer,
  createInitialUserSettingsState,
  type TabId,
} from "../reducers";
import "../styles/UserSettings.css";

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

interface SettingsUpdateData extends Partial<UserSettingsType> {}

const UserSettings: React.FC = () => {
  const navigate = useNavigate();
  const { updateUnitSystem } = useUnits();

  // Initialize reducer
  const [state, dispatch] = useReducer(
    userSettingsReducer,
    createInitialUserSettingsState()
  );

  // Destructure state for cleaner access
  const {
    settings,
    activeTab,
    loading,
    saving,
    error,
    successMessage,
    hasUnsavedChanges,
    profileForm,
    passwordForm,
    deleteForm,
    preferencesForm,
    privacyForm,
    originalProfileForm,
    originalPreferencesForm,
    originalPrivacyForm,
  } = state;

  // Load user settings on mount
  useEffect(() => {
    const loadSettings = async (): Promise<void> => {
      try {
        dispatch({ type: 'INITIALIZE_START' });
        const userSettings = await Services.userSettings.getUserSettings();

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

        dispatch({
          type: 'INITIALIZE_SUCCESS',
          payload: {
            settings: userSettings,
            profileForm: profileData,
            preferencesForm: preferencesData,
            privacyForm: privacyData,
          },
        });
      } catch (err: any) {
        console.error("Error loading settings:", err);
        dispatch({ type: 'INITIALIZE_ERROR', payload: "Failed to load user settings" });
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
    dispatch({ type: 'SET_UNSAVED_CHANGES', payload: hasChanges });
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
      const timer = setTimeout(() => dispatch({ type: 'CLEAR_SUCCESS_MESSAGE' }), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [successMessage]);

  const handleProfileSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    try {
      dispatch({ type: 'SAVE_START' });

      await Services.userSettings.updateProfile(profileForm);
      // Update original to match saved state
      dispatch({ type: 'UPDATE_ORIGINAL_PROFILE_FORM', payload: profileForm });
      dispatch({ type: 'SAVE_SUCCESS', payload: "Profile updated successfully" });
    } catch (err: any) {
      dispatch({ type: 'SAVE_ERROR', payload: err.message || "Failed to update profile" });
    }
  };

  const handlePasswordSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    try {
      dispatch({ type: 'SAVE_START' });

      await Services.userSettings.changePassword(passwordForm);
      dispatch({ type: 'SAVE_SUCCESS', payload: "Password changed successfully" });
      dispatch({ type: 'RESET_PASSWORD_FORM' });
    } catch (err: any) {
      dispatch({ type: 'SAVE_ERROR', payload: err.message || "Failed to change password" });
    }
  };

  const handlePreferencesSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    try {
      dispatch({ type: 'SAVE_START' });

      // Update preferences using the settings service
      await Services.userSettings.updateSettings(
        preferencesForm as SettingsUpdateData
      );

      // Update the global unit context with the new preferred units
      await updateUnitSystem(
        preferencesForm.preferred_units as "imperial" | "metric"
      );

      dispatch({ type: 'UPDATE_ORIGINAL_PREFERENCES_FORM', payload: preferencesForm });
      dispatch({ type: 'SAVE_SUCCESS', payload: "Preferences updated successfully" });
    } catch (err: any) {
      dispatch({ type: 'SAVE_ERROR', payload: err.message || "Failed to update preferences" });
    }
  };

  const handlePrivacySubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    try {
      dispatch({ type: 'SAVE_START' });

      await Services.userSettings.updateSettings(privacyForm);
      dispatch({ type: 'UPDATE_ORIGINAL_PRIVACY_FORM', payload: privacyForm });
      dispatch({ type: 'SAVE_SUCCESS', payload: "Privacy settings updated successfully" });
    } catch (err: any) {
      dispatch({ type: 'SAVE_ERROR', payload: err.message || "Failed to update privacy settings" });
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
      dispatch({ type: 'SAVE_START' });

      await Services.userSettings.deleteAccount(deleteForm);
      // Logout and redirect
      localStorage.removeItem("token");
      window.dispatchEvent(new Event("authChange"));
      navigate("/login");
    } catch (err: any) {
      dispatch({ type: 'SAVE_ERROR', payload: err.message || "Failed to delete account" });
    }
  };

  // Handle unit system change with default batch size
  const handleUnitSystemChange = (
    newUnitSystem: "imperial" | "metric"
  ): void => {
    const defaultBatchSize = newUnitSystem === "metric" ? 19 : 5;

    dispatch({
      type: 'UPDATE_PREFERENCES_FIELD',
      payload: { field: 'preferred_units', value: newUnitSystem }
    });
    dispatch({
      type: 'UPDATE_PREFERENCES_FIELD',
      payload: { field: 'default_batch_size', value: defaultBatchSize }
    });
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
                  dispatch({ type: 'SET_UNSAVED_CHANGES', payload: false });
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
              <button onClick={() => dispatch({ type: 'CLEAR_ERROR' })} className="error-dismiss">
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
                onClick={() => dispatch({ type: 'CLEAR_SUCCESS_MESSAGE' })}
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
                onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab.id })}
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
                        dispatch({
                          type: 'UPDATE_PROFILE_FIELD',
                          payload: { field: 'username', value: e.target.value }
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
                        dispatch({
                          type: 'UPDATE_PROFILE_FIELD',
                          payload: { field: 'email', value: e.target.value }
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
                        dispatch({
                          type: 'UPDATE_PREFERENCES_FIELD',
                          payload: { field: 'default_batch_size', value: parseFloat(e.target.value) }
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
                            dispatch({
                              type: 'UPDATE_PREFERENCES_FIELD',
                              payload: { field: 'email_notifications', value: e.target.checked }
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
                            dispatch({
                              type: 'UPDATE_PREFERENCES_FIELD',
                              payload: { field: 'brew_reminders', value: e.target.checked }
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
                            dispatch({
                              type: 'UPDATE_PRIVACY_FIELD',
                              payload: { field: 'contribute_anonymous_data', value: e.target.checked }
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
                            dispatch({
                              type: 'UPDATE_PRIVACY_FIELD',
                              payload: { field: 'share_yeast_performance', value: e.target.checked }
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
                            dispatch({
                              type: 'UPDATE_PRIVACY_FIELD',
                              payload: { field: 'share_recipe_metrics', value: e.target.checked }
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
                            dispatch({
                              type: 'UPDATE_PRIVACY_FIELD',
                              payload: { field: 'public_recipes_default', value: e.target.checked }
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
                          dispatch({
                            type: 'UPDATE_PASSWORD_FIELD',
                            payload: { field: 'current_password', value: e.target.value }
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
                          dispatch({
                            type: 'UPDATE_PASSWORD_FIELD',
                            payload: { field: 'new_password', value: e.target.value }
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
                          dispatch({
                            type: 'UPDATE_PASSWORD_FIELD',
                            payload: { field: 'confirm_password', value: e.target.value }
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
                      and cannot be undone. Your personal data, private recipes, and brew sessions will be permanently deleted.
                    </p>
                  </div>

                  <form
                    onSubmit={handleDeleteAccount}
                    className="settings-form"
                  >
                    {/* Data Preservation Choice */}
                    <div className="form-group">
                      <label className="form-label">
                        What should happen to your public recipes?
                      </label>
                      <div className="radio-group">
                        <label className="radio-option">
                          <input
                            type="radio"
                            name="preserve_public_recipes"
                            checked={deleteForm.preserve_public_recipes}
                            onChange={() =>
                              dispatch({
                                type: 'UPDATE_DELETE_FIELD',
                                payload: { field: 'preserve_public_recipes', value: true }
                              })
                            }
                            disabled={saving}
                          />
                          <span className="radio-label">
                            <strong>Keep for community</strong> - Transfer public recipes to "Anonymous User" so others can still access them
                          </span>
                        </label>
                        <label className="radio-option">
                          <input
                            type="radio"
                            name="preserve_public_recipes"
                            checked={!deleteForm.preserve_public_recipes}
                            onChange={() =>
                              dispatch({
                                type: 'UPDATE_DELETE_FIELD',
                                payload: { field: 'preserve_public_recipes', value: false }
                              })
                            }
                            disabled={saving}
                          />
                          <span className="radio-label">
                            <strong>Delete everything</strong> - Permanently delete all recipes including public ones
                          </span>
                        </label>
                      </div>
                      <p className="form-help">
                        {deleteForm.preserve_public_recipes
                          ? "Recommended: Your public recipes will remain available to the community with anonymous attribution."
                          : "Warning: This will permanently delete all your recipes, including those shared publicly."}
                      </p>
                    </div>
                    <div className="form-group">
                      <label htmlFor="delete_password" className="form-label">
                        Enter your password to confirm
                      </label>
                      <input
                        type="password"
                        id="delete_password"
                        value={deleteForm.password}
                        onChange={(e) =>
                          dispatch({
                            type: 'UPDATE_DELETE_FIELD',
                            payload: { field: 'password', value: e.target.value }
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
                          dispatch({
                            type: 'UPDATE_DELETE_FIELD',
                            payload: { field: 'confirmation', value: e.target.value }
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
