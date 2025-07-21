import React, { useState, useEffect, useCallback } from "react";
import { Services } from "../../../services";
import { Recipe, RecipeMetrics } from "../../../types";
import {
  BeerStyleGuide,
  StyleSuggestion as BeerStyleSuggestion,
} from "../../../types/beer-styles";
import {
  formatGravity,
  formatAbv,
  formatIbu,
  formatSrm,
} from "../../../utils/formatUtils";

interface StyleMatch {
  matches: Record<string, boolean>;
  percentage: number;
}

interface StyleAnalysisResult {
  found: boolean;
  style?: BeerStyleGuide;
  match_result?: StyleMatch;
  declared_style?: string;
}

interface StyleAnalysisProps {
  recipe?: Recipe;
  metrics?: RecipeMetrics;
  onStyleSuggestionSelect: (styleName: string) => void;
  variant?: "main" | "sidebar";
}

const StyleAnalysis: React.FC<StyleAnalysisProps> = ({
  recipe,
  metrics,
  onStyleSuggestionSelect,
  variant = "sidebar",
}) => {
  const [analysis, setAnalysis] = useState<StyleAnalysisResult | null>(null);
  const [suggestions, setSuggestions] = useState<BeerStyleSuggestion[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadRealtimeStyleAnalysis = useCallback(async (): Promise<void> => {
    if (!recipe?.style || !metrics) return;

    try {
      setLoading(true);
      setError(null);

      // Get all styles to find the matching one
      const allStyles = await Services.beerStyle.getAllStylesList();
      const selectedStyle = allStyles.find(
        (style: any) =>
          style.name.toLowerCase() === recipe.style!.toLowerCase() ||
          style.display_name.toLowerCase() === recipe.style!.toLowerCase()
      );

      if (selectedStyle) {
        // Calculate real-time match using the current metrics
        const matchResult = Services.beerStyle.calculateStyleMatch(
          selectedStyle,
          metrics
        );

        setAnalysis({
          found: true,
          style: selectedStyle,
          match_result: matchResult,
        });
      } else {
        setAnalysis({
          found: false,
          declared_style: recipe.style,
        });
      }

      // Also get style suggestions
      const suggestionsResult = await Services.beerStyle.findMatchingStyles(
        metrics
      );
      setSuggestions(suggestionsResult.slice(0, 5));
    } catch (error: any) {
      console.error("Error loading real-time style analysis:", error);
      setError("Failed to load style analysis");
    } finally {
      setLoading(false);
    }
  }, [recipe?.style, metrics]);

  const loadStyleSuggestionsOnly = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const suggestionsResult = await Services.beerStyle.findMatchingStyles(
        metrics!
      );
      setSuggestions(suggestionsResult.slice(0, 5));
      setAnalysis(null);
    } catch (error: any) {
      console.error("Error loading style suggestions:", error);
      setError("Failed to load style suggestions");
    } finally {
      setLoading(false);
    }
  }, [metrics]);

  useEffect(() => {
    if (metrics && recipe?.style) {
      // Real-time style analysis based on current metrics and selected style
      loadRealtimeStyleAnalysis();
    } else if (metrics && !recipe?.style && variant === "main") {
      // Only load suggestions when no style is selected and in main variant
      loadStyleSuggestionsOnly();
    }
  }, [
    recipe?.style,
    metrics,
    variant,
    loadRealtimeStyleAnalysis,
    loadStyleSuggestionsOnly,
  ]);

  const getMatchStatusColor = (matches: Record<string, boolean>): string => {
    const matchCount = Object.values(matches).filter(Boolean).length;
    const totalSpecs = Object.keys(matches).length;
    const percentage = totalSpecs > 0 ? (matchCount / totalSpecs) * 100 : 0;

    if (percentage >= 80) return "success";
    if (percentage >= 60) return "warning";
    return "danger";
  };

  // Helper function to format values for specific spec types
  const formatValueForSpec = (spec: string, value: number): string => {
    switch (spec) {
      case "og":
      case "fg":
        return formatGravity(value);
      case "abv":
        return formatAbv(value);
      case "ibu":
        return formatIbu(value);
      case "srm":
        return formatSrm(value);
      default:
        return value.toFixed(1);
    }
  };

  // Helper function to format style ranges for spec breakdown
  const formatStyleRange = (spec: string, style: BeerStyleGuide): string => {
    let range;
    switch (spec) {
      case "og":
        range = style.original_gravity;
        break;
      case "fg":
        range = style.final_gravity;
        break;
      case "abv":
        range = style.alcohol_by_volume;
        break;
      case "ibu":
        range = style.international_bitterness_units;
        break;
      case "srm":
        range = style.color;
        break;
      default:
        return "";
    }

    if (!range?.minimum?.value || !range?.maximum?.value) return "";

    const min = formatValueForSpec(spec, range.minimum.value);
    const max = formatValueForSpec(spec, range.maximum.value);
    return `${min} - ${max}`;
  };

  const renderStyleAnalysis = (): React.ReactElement | null => {
    if (!analysis?.found || !analysis.match_result) return null;

    const { matches, percentage } = analysis.match_result;

    return (
      <div className="style-analysis-result">
        <div className="style-analysis-content">
          <div className="style-match-header">
            <span className="style-name">{recipe?.style}</span>
            <span
              className={`match-percentage ${getMatchStatusColor(matches)}`}
            >
              {Math.round(percentage)}% match
            </span>
          </div>
          <div className="spec-breakdown">
            {Object.entries(analysis.match_result.matches).map(
              ([spec, matches]) => (
                <div
                  key={spec}
                  className={`spec-match ${matches ? "match" : "no-match"}`}
                >
                  <span className="spec-name">{spec.toUpperCase()}</span>
                  <span className="match-indicator">{matches ? "✓" : "✗"}</span>
                  <span className="spec-range">
                    {formatStyleRange(spec, analysis.style!)}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    );
  };

  // Sidebar variant should not render when no style is selected
  if (variant === "sidebar" && !recipe?.style) {
    return null;
  }

  if (loading) {
    return (
      <div className="style-analysis loading">
        <div className="loading-indicator">
          <span className="spinner"></span>
          Analyzing style compatibility...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="style-analysis error">
        <h3 className="analysis-title">Style Analysis</h3>
        <div className="error-message">
          <p className="text-warning">{error}</p>
        </div>
      </div>
    );
  }

  // If no metrics available
  if (
    !metrics ||
    (!metrics.og && !metrics.abv && !metrics.ibu && !metrics.srm)
  ) {
    return (
      <div className="style-analysis no-metrics">
        <h3 className="analysis-title">Style Analysis</h3>
        <p className="help-text">
          Add ingredients to your recipe to calculate metrics and get style
          analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="style-analysis">
      <h3 className="analysis-title">Style Analysis</h3>

      {/* Current Style Analysis */}
      {recipe?.style && analysis && (
        <div className="current-style-analysis">
          {analysis.found ? (
            <div className="style-analysis-container">
              {renderStyleAnalysis()}
            </div>
          ) : (
            <div className="style-not-found">
              <p>
                Style "{recipe.style}" not found in database. Recipe metrics
                will be compared against similar styles below.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Style suggestions - only show when no style is selected and in main variant */}
      {variant === "main" && !recipe?.style && suggestions.length > 0 && (
        <div className="style-suggestions">
          <h4>Suggested Styles Based on Current Metrics</h4>
          <p className="suggestions-help">
            Select a style to see detailed analysis, or click a suggestion to
            set it as your target style.
          </p>
          <div className="suggestions-list">
            {suggestions.slice(0, 3).map((suggestion, index) => (
              <div key={index} className="suggestion-item">
                <div className="suggestion-header">
                  <div className="style-info">
                    <span className="style-id">
                      {suggestion.style.style_id}
                    </span>
                    <span className="style-name">{suggestion.style.name}</span>
                    <button
                      onClick={() =>
                        onStyleSuggestionSelect(suggestion.style.name)
                      }
                      className="select-style-btn"
                    >
                      Select Style
                    </button>
                  </div>
                  <span className="match-score">
                    {Math.round(suggestion.match_percentage)}% match
                  </span>
                </div>
                <div className="suggestion-details">
                  <div className="match-breakdown">
                    {Object.entries(suggestion.matches).map(
                      ([spec, matches]) => (
                        <span
                          key={spec}
                          className={`spec-indicator ${
                            matches ? "match" : "no-match"
                          }`}
                        >
                          {spec.toUpperCase()}
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No matches */}
      {variant === "main" &&
        suggestions.length === 0 &&
        !loading &&
        !error &&
        !recipe?.style && (
          <div className="no-suggestions">
            <p>
              No close style matches found. Your recipe may be a unique
              creation!
            </p>
            <p className="help-text">
              Try selecting a style manually to see how close you are to
              established guidelines.
            </p>
          </div>
        )}
    </div>
  );
};

export default StyleAnalysis;
