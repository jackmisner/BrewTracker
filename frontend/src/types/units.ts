// Unit system types
export type UnitSystem = "imperial" | "metric";

// Weight units
export type WeightUnit = "oz" | "lb" | "g" | "kg";

// Volume units
export type VolumeUnit = "ml" | "l" | "fl oz" | "cup" | "pt" | "qt" | "gal";

// Temperature units
export type TemperatureUnit = "f" | "c";

// Time units
export type TimeUnit = "min" | "day";

// Pressure units
export type PressureUnit = "psi" | "bar" | "kpa" | "atm";

// Measurement type categories
export type MeasurementType =
  | "weight"
  | "volume"
  | "temperature"
  | "time"
  | "pressure"
  | "hop_weight"
  | "yeast"
  | "other";

// Unit definition with conversion info
export interface UnitDefinition {
  value: string;
  label: string;
  description: string;
  system: UnitSystem;
  base_conversion?: number; // Multiplier to base unit
}

// Unit conversion result
export interface UnitConversion {
  value: number;
  unit: string;
}

// Unit preference configuration
export interface UnitPreferences {
  system: UnitSystem;
  weight: WeightUnit;
  volume: VolumeUnit;
  temperature: TemperatureUnit;
  hop_weight: WeightUnit;
  grain_weight: WeightUnit;
  batch_size: VolumeUnit;
}

// Measurement with unit
export interface Measurement {
  value: number;
  unit: string;
  display_value?: string; // Formatted for display
}

// Unit conversion context
export interface UnitConversionContext {
  from_system: UnitSystem;
  to_system: UnitSystem;
  measurement_type: MeasurementType;
  precision?: number;
}

// Batch size configuration
export interface BatchSizeConfig {
  value: number;
  unit: VolumeUnit;
  system: UnitSystem;
}

// Typical batch sizes for different systems
export interface TypicalBatchSizes {
  value: number;
  label: string;
  unit: VolumeUnit;
}

// Unit display configuration
export interface UnitDisplayConfig {
  show_system_indicator: boolean;
  decimal_places: number;
  use_fractions: boolean; // For imperial measurements
  compact_format: boolean;
}

// Ingredient unit mappings by type
export interface IngredientUnitMappings {
  grain: {
    imperial: WeightUnit[];
    metric: WeightUnit[];
    default_imperial: WeightUnit;
    default_metric: WeightUnit;
  };
  hop: {
    imperial: WeightUnit[];
    metric: WeightUnit[];
    default_imperial: WeightUnit;
    default_metric: WeightUnit;
  };
  yeast: {
    imperial: string[];
    metric: string[];
    default_imperial: string;
    default_metric: string;
  };
  other: {
    imperial: string[];
    metric: string[];
    default_imperial: string;
    default_metric: string;
  };
}

// Unit conversion matrices for common conversions
export interface ConversionMatrix {
  [fromUnit: string]: {
    [toUnit: string]: number;
  };
}

// Unit validation result
export interface UnitValidation {
  is_valid: boolean;
  supported_units: string[];
  suggested_unit?: string;
  error_message?: string;
}

// Recipe scaling unit considerations
export interface ScalingUnitContext {
  original_batch_size: Measurement;
  target_batch_size: Measurement;
  scaling_factor: number;
  unit_conversions_needed: boolean;
}

// Formatting options for unit display
export interface UnitFormatOptions {
  precision?: number;
  use_fractions?: boolean;
  compact?: boolean;
  include_unit?: boolean;
  scientific_notation?: boolean;
}

// Common unit groups for UI dropdowns
export interface UnitGroups {
  weight: UnitDefinition[];
  volume: UnitDefinition[];
  temperature: UnitDefinition[];
  time: UnitDefinition[];
  [key: string]: UnitDefinition[];
}

// Unit system constants
export interface UnitSystemConstants {
  IMPERIAL: {
    WEIGHT: {
      OZ_TO_LB: number;
      LB_TO_OZ: number;
    };
    VOLUME: {
      FL_OZ_TO_GAL: number;
      GAL_TO_FL_OZ: number;
      CUP_TO_GAL: number;
      PT_TO_GAL: number;
      QT_TO_GAL: number;
    };
    TEMPERATURE: {
      F_TO_C_MULTIPLIER: number;
      F_TO_C_OFFSET: number;
    };
  };
  METRIC: {
    WEIGHT: {
      G_TO_KG: number;
      KG_TO_G: number;
    };
    VOLUME: {
      ML_TO_L: number;
      L_TO_ML: number;
    };
    TEMPERATURE: {
      C_TO_K_OFFSET: number;
    };
  };
  CONVERSION: {
    LB_TO_KG: number;
    KG_TO_LB: number;
    GAL_TO_L: number;
    L_TO_GAL: number;
    OZ_TO_G: number;
    G_TO_OZ: number;
  };
}

// Unit context state for React context
export interface UnitContextState {
  unitSystem: UnitSystem;
  loading: boolean;
  error: string | null;
  preferences?: UnitPreferences;
}

// Unit context actions
export interface UnitContextActions {
  updateUnitSystem: (system: UnitSystem) => Promise<void>;
  setError: (error: string | null) => void;
  getPreferredUnit: (measurementType: MeasurementType) => string;
  convertUnit: (
    value: number,
    fromUnit: string,
    toUnit: string
  ) => UnitConversion;
  convertForDisplay: (
    value: number,
    storageUnit: string,
    measurementType: MeasurementType
  ) => UnitConversion;
  convertForStorage: (
    value: number,
    displayUnit: string,
    measurementType: MeasurementType
  ) => UnitConversion;
  formatValue: (
    value: number,
    unit: string,
    measurementType: MeasurementType,
    precision?: number
  ) => string;
  getUnitSystemLabel: () => string;
  getUnitSystemIcon: () => string;
  getCommonUnits: (measurementType: MeasurementType) => UnitDefinition[];
  convertBatch: (
    ingredients: any[],
    fromBatchSize: number,
    toBatchSize: number,
    fromUnit: string,
    toUnit: string
  ) => any[];
  getTypicalBatchSizes: () => TypicalBatchSizes[];
}
