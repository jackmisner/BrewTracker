import { ID, BaseEntity } from './common';
import { Recipe } from './recipe';
import { TemperatureUnit } from './units';

// Brew session status options
export type BrewSessionStatus = 
  | 'planned'
  | 'in-progress' 
  | 'fermenting'
  | 'conditioning'
  | 'completed'
  | 'archived';

// Fermentation entry for tracking data points
export interface FermentationEntry {
  entry_date: string; // ISO date string
  temperature?: number;
  gravity?: number; // Specific gravity (e.g., 1.010)
  ph?: number;
  notes?: string;
}

// Main brew session interface
export interface BrewSession extends BaseEntity {
  session_id: ID;
  recipe_id: ID;
  user_id: ID;
  brew_date: string; // ISO date string (date only)
  name?: string;
  status: BrewSessionStatus;
  
  // Brew day measurements
  mash_temp?: number;
  actual_og?: number;
  actual_fg?: number;
  actual_abv?: number;
  actual_efficiency?: number;
  
  // Important dates
  fermentation_start_date?: string; // ISO date string
  fermentation_end_date?: string; // ISO date string  
  packaging_date?: string; // ISO date string
  
  // Fermentation tracking data
  fermentation_data: FermentationEntry[];
  
  // Notes and ratings
  notes?: string;
  tasting_notes?: string;
  batch_rating?: number; // 1-5 scale
  photos_url?: string;
  
  // Store recipe snapshot as JSON string to preserve history
  recipe_snapshot?: string;
  
  // Temperature unit preference
  temperature_unit: TemperatureUnit;
  
  // Timestamps
  created_at?: string;
  updated_at?: string;
}

// Brew session creation form data
export interface CreateBrewSessionFormData {
  recipe_id: ID;
  name?: string;
  brew_date?: string;
  status?: BrewSessionStatus;
  mash_temp?: number;
  notes?: string;
  temperature_unit?: TemperatureUnit;
}

// Brew session update form data
export interface UpdateBrewSessionFormData extends Partial<CreateBrewSessionFormData> {
  actual_og?: number;
  actual_fg?: number;
  actual_abv?: number;
  actual_efficiency?: number;
  fermentation_start_date?: string;
  fermentation_end_date?: string;
  packaging_date?: string;
  tasting_notes?: string;
  batch_rating?: number;
  photos_url?: string;
}

// Fermentation entry form data
export interface FermentationEntryFormData {
  temperature?: number | null;
  gravity?: number | null;
  ph?: number | null;
  notes?: string | null;
}

// Brew session with populated recipe data
export interface BrewSessionWithRecipe extends BrewSession {
  recipe: Recipe;
}

// Fermentation statistics
export interface FermentationStats {
  duration_days: number;
  gravity_drop: number;
  average_temperature: number;
  current_attenuation: number;
  projected_fg: number;
  temperature_range: {
    min: number;
    max: number;
    unit: TemperatureUnit;
  };
  gravity_trend: 'falling' | 'stable' | 'rising' | 'unknown';
}

// Brew session timeline event
export interface BrewSessionTimelineEvent {
  date: string;
  event_type: 'brew_day' | 'fermentation_start' | 'fermentation_entry' | 'fermentation_end' | 'packaging' | 'tasting';
  title: string;
  description?: string;
  data?: FermentationEntry | Partial<BrewSession>;
  icon?: string;
}

// Brew session analysis
export interface BrewSessionAnalysis {
  efficiency_analysis: {
    target_efficiency: number;
    actual_efficiency: number;
    variance: number;
    performance: 'excellent' | 'good' | 'average' | 'below_average' | 'poor';
  };
  fermentation_analysis: {
    duration: number;
    attenuation: number;
    temperature_consistency: number;
    health_score: number; // 0-100
    issues: string[];
    recommendations: string[];
  };
  recipe_adherence: {
    og_variance: number;
    fg_variance: number;
    overall_score: number;
    deviations: Array<{
      parameter: string;
      target: number;
      actual: number;
      variance_percent: number;
    }>;
  };
}

// Brewing calendar event
export interface BrewingCalendarEvent {
  date: string;
  session_id: ID;
  session_name: string;
  recipe_name: string;
  event_type: BrewSessionTimelineEvent['event_type'];
  status: BrewSessionStatus;
  priority: 'low' | 'medium' | 'high';
}

// Brew session comparison
export interface BrewSessionComparison {
  sessions: BrewSession[];
  recipe: Recipe;
  comparison_metrics: {
    efficiency: {
      values: number[];
      average: number;
      best: number;
      worst: number;
    };
    og: {
      values: number[];
      target: number;
      variance: number;
    };
    fg: {
      values: number[];
      target: number;
      variance: number;
    };
    attenuation: {
      values: number[];
      average: number;
    };
  };
  trends: {
    efficiency_trend: 'improving' | 'declining' | 'stable';
    consistency_score: number;
  };
}

// Brew session search/filter options
export interface BrewSessionFilters {
  status?: BrewSessionStatus[];
  recipe_id?: ID;
  date_range?: {
    start: string;
    end: string;
  };
  rating_range?: {
    min: number;
    max: number;
  };
  has_notes?: boolean;
  has_fermentation_data?: boolean;
}

// Brew session summary (for recipe cards and dashboard)
export interface BrewSessionSummary {
  total: number;
  active: number;
  completed: number;
  mostRecent: BrewSession | null;
  mostRelevant: BrewSession | null;
  averageRating: number | null;
  averageABV: number | null;
  successRate: number | null;
}

// Extended brew session with computed display properties
export interface ProcessedBrewSession extends BrewSession {
  displayName: string;
  formattedStatus: string;
  statusColor: string;
  duration: number | null;
  isActive: boolean;
}

// Extension to BrewSession for UI display properties
export interface BrewSessionWithDisplay extends BrewSession {
  statusColor?: string;
  formattedStatus?: string;
}

// Brew session statistics for dashboard
export interface BrewSessionStatistics {
  total_sessions: number;
  active_sessions: number;
  completed_sessions: number;
  average_efficiency: number;
  average_rating: number;
  total_batches_volume: number;
  volume_unit: string;
  most_brewed_style: string;
  brewing_frequency: {
    sessions_per_month: number;
    last_brew_date: string;
  };
  efficiency_trend: {
    last_5_sessions: number[];
    trend: 'improving' | 'declining' | 'stable';
  };
}

// Brew session export options
export interface BrewSessionExportOptions {
  format: 'json' | 'csv' | 'pdf';
  include_recipe: boolean;
  include_fermentation_data: boolean;
  include_photos: boolean;
  date_range?: {
    start: string;
    end: string;
  };
}

// Brew session notification/reminder
export interface BrewSessionReminder {
  session_id: ID;
  reminder_type: 'brew_day' | 'fermentation_check' | 'packaging' | 'tasting';
  scheduled_date: string;
  message: string;
  sent: boolean;
  created_at: string;
}

// Brew session validation
export interface BrewSessionValidation {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  required_fields: string[];
}

// Equipment used in brew session (future extension)
export interface BrewSessionEquipment {
  mash_tun_capacity?: number;
  boil_kettle_capacity?: number;
  fermenter_type?: string;
  fermenter_capacity?: number;
  temperature_control?: boolean;
  additional_equipment?: string[];
}

// Water profile used (future extension)
export interface BrewSessionWaterProfile {
  source: string;
  ph?: number;
  hardness?: number;
  mineral_additions?: Array<{
    mineral: string;
    amount: number;
    unit: string;
  }>;
}