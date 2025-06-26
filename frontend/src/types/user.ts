import { ID, BaseEntity } from './common';
import { UnitSystem } from './units';

// User settings embedded document
export interface UserSettings {
  // Privacy Settings
  contribute_anonymous_data: boolean;
  share_yeast_performance: boolean;
  share_recipe_metrics: boolean;
  public_recipes_default: boolean;
  
  // Application Preferences
  default_batch_size: number;
  preferred_units: UnitSystem;
  timezone: string;
  
  // Notification Preferences
  email_notifications: boolean;
  brew_reminders: boolean;
}

// Main user interface
export interface User extends BaseEntity {
  user_id: ID;
  username: string;
  email: string;
  created_at?: string;
  last_login?: string;
  is_active: boolean;
  email_verified: boolean;
  settings: UserSettings;
}

// User authentication state
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

// Login form data
export interface LoginFormData {
  username: string;
  password: string;
  remember_me?: boolean;
}

// Registration form data
export interface RegistrationFormData {
  username: string;
  email: string;
  password: string;
  confirm_password: string;
  accept_terms: boolean;
}

// Password change form data
export interface PasswordChangeFormData {
  current_password: string;
  new_password: string;
  confirm_new_password: string;
}

// Profile update form data
export interface ProfileUpdateFormData {
  username?: string;
  email?: string;
  timezone?: string;
}

// Settings update form data
export interface SettingsUpdateFormData extends Partial<UserSettings> {}

// Account deletion form data
export interface AccountDeletionFormData {
  password: string;
  confirmation: string;
  reason?: string;
}

// JWT token payload
export interface JWTPayload {
  user_id: ID;
  username: string;
  email: string;
  exp: number; // Expiration timestamp
  iat: number; // Issued at timestamp
}

// Authentication context state
export interface AuthContextState extends AuthState {
  // Additional computed properties
  isTokenExpired: boolean;
  timeUntilExpiry: number | null;
}

// Authentication context actions
export interface AuthContextActions {
  login: (credentials: LoginFormData) => Promise<User>;
  register: (userData: RegistrationFormData) => Promise<User>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<string>;
  updateProfile: (profileData: ProfileUpdateFormData) => Promise<User>;
  updateSettings: (settingsData: SettingsUpdateFormData) => Promise<UserSettings>;
  changePassword: (passwordData: PasswordChangeFormData) => Promise<void>;
  deleteAccount: (confirmationData: AccountDeletionFormData) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  confirmPasswordReset: (token: string, newPassword: string) => Promise<void>;
  clearError: () => void;
}

// User preferences (extended settings)
export interface UserPreferences extends UserSettings {
  // UI Preferences
  theme: 'light' | 'dark' | 'auto';
  compact_mode: boolean;
  show_tooltips: boolean;
  
  // Recipe Preferences
  default_efficiency: number;
  default_boil_time: number;
  favorite_recipe_styles: string[];
  hidden_ingredients: ID[];
  
  // Brew Session Preferences
  default_fermentation_temp: number;
  temperature_unit: 'f' | 'c';
  gravity_display_format: 'sg' | 'plato' | 'both';
  
  // Data Export Preferences
  export_format: 'beerxml' | 'json' | 'pdf';
  include_private_recipes: boolean;
  include_brew_notes: boolean;
}

// User activity tracking
export interface UserActivity {
  user_id: ID;
  last_recipe_created?: string;
  last_brew_session?: string;
  recipes_created_count: number;
  brew_sessions_count: number;
  public_recipes_count: number;
  total_batches_brewed: number;
  favorite_styles: string[];
  most_used_ingredients: Array<{
    ingredient_id: ID;
    name: string;
    usage_count: number;
  }>;
}

// User subscription/tier information
export interface UserSubscription {
  tier: 'free' | 'premium' | 'professional';
  expires_at?: string;
  features: {
    max_recipes: number;
    max_brew_sessions: number;
    advanced_analytics: boolean;
    export_formats: string[];
    api_access: boolean;
    priority_support: boolean;
  };
}

// User profile completeness
export interface ProfileCompleteness {
  percentage: number;
  missing_fields: string[];
  suggestions: string[];
}

// User notification settings
export interface NotificationSettings {
  email_notifications: boolean;
  push_notifications?: boolean;
  brew_reminders: boolean;
  recipe_shares: boolean;
  system_updates: boolean;
  marketing_emails: boolean;
  
  // Reminder preferences
  brew_day_reminder_days: number;
  fermentation_check_days: number[];
  packaging_reminder_days: number;
}

// Privacy settings
export interface PrivacySettings {
  profile_visibility: 'public' | 'friends' | 'private';
  recipe_visibility_default: 'public' | 'private';
  share_anonymous_data: boolean;
  allow_recipe_cloning: boolean;
  show_in_leaderboards: boolean;
}

// User session information
export interface UserSession {
  session_id: string;
  user_id: ID;
  created_at: string;
  last_activity: string;
  ip_address?: string;
  user_agent?: string;
  is_current: boolean;
}

// User validation results
export interface UserValidation {
  username: {
    is_valid: boolean;
    is_available: boolean;
    errors: string[];
  };
  email: {
    is_valid: boolean;
    is_available: boolean;
    errors: string[];
  };
  password: {
    is_valid: boolean;
    strength: 'weak' | 'medium' | 'strong';
    errors: string[];
  };
}

// Two-factor authentication
export interface TwoFactorAuth {
  enabled: boolean;
  method: 'app' | 'sms' | 'email';
  backup_codes: string[];
  last_used?: string;
}

// User export data
export interface UserExportData {
  user: User;
  recipes: any[]; // Recipe type from recipe.ts
  brew_sessions: any[]; // BrewSession type from brew-session.ts
  settings: UserPreferences;
  created_at: string;
  export_version: string;
}