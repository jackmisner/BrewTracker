import React, { useState, useEffect } from "react";
import BeerStyleService from "../../../services/BeerStyleService";
import StyleRangeIndicator from "./StyleRangeIndicator";
import { Recipe, RecipeMetrics } from "../../../types";
import { BeerStyleGuide, StyleSuggestion as BeerStyleSuggestion } from "../../../types/beer-styles";

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
}

const StyleAnalysis: React.FC<StyleAnalysisProps> = ({ 
  recipe, 
  metrics, 
  onStyleSuggestionSelect 
}) => {
  const [analysis, setAnalysis] = useState<StyleAnalysisResult | null>(null);
  const [suggestions, setSuggestions] = useState<BeerStyleSuggestion[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  useEffect(() => {
    if (metrics && recipe?.style) {
      // Real-time style analysis based on current metrics and selected style
      loadRealtimeStyleAnalysis();
    } else if (metrics && !recipe?.style) {
      // Only load suggestions when no style is selected
      loadStyleSuggestionsOnly();
    }
  }, [recipe?.style, metrics]);

  const loadRealtimeStyleAnalysis = async (): Promise<void> => {
    if (!recipe?.style || !metrics) return;

    try {
      setLoading(true);
      setError(null);

      // Get all styles to find the matching one
      const allStyles = await BeerStyleService.getAllStylesList();
      const selectedStyle = allStyles.find(
        (style: any) =>
          style.name.toLowerCase() === recipe.style!.toLowerCase() ||
          style.display_name.toLowerCase() === recipe.style!.toLowerCase()
      );

      if (selectedStyle) {
        // Calculate real-time match using the current metrics
        const matchResult = BeerStyleService.calculateStyleMatch(
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
      const suggestionsResult = await BeerStyleService.findMatchingStyles(
        metrics
      );
      setSuggestions(suggestionsResult.slice(0, 5));
    } catch (error: any) {
      console.error("Error loading real-time style analysis:", error);
      setError("Failed to load style analysis");
    } finally {
      setLoading(false);
    }
  };

  const loadStyleSuggestionsOnly = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const suggestionsResult = await BeerStyleService.findMatchingStyles(
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
  };

  const getMatchStatusColor = (matches: Record<string, boolean>): string => {
    const matchCount = Object.values(matches).filter(Boolean).length;
    const totalSpecs = Object.keys(matches).length;
    const percentage = totalSpecs > 0 ? (matchCount / totalSpecs) * 100 : 0;

    if (percentage >= 80) return "success";
    if (percentage >= 60) return "warning";
    return "danger";
  };

  const getMatchStatusText = (matches: Record<string, boolean>): string => {
    const matchCount = Object.values(matches).filter(Boolean).length;
    const totalSpecs = Object.keys(matches).length;
    return `${matchCount}/${totalSpecs} specs match`;
  };

  const toggleExpanded = (): void => {
    setIsExpanded(!isExpanded);
  };

  const renderCompactAnalysis = (): React.ReactElement | null => {
    if (!analysis?.found || !analysis.match_result) return null;

    const { matches, percentage } = analysis.match_result;

    return (
      <div
        className="style-analysis-compact"
        onClick={toggleExpanded}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleExpanded();
          }
        }}
      >
        <div className="compact-content">
          <span className="compact-style-name">{recipe?.style}</span>
          <span
            className={`compact-match-percentage ${getMatchStatusColor(
              matches
            )}`}
          >
            {Math.round(percentage)}% match
          </span>
          <span className="expand-indicator">{isExpanded ? "▼" : "▶"}</span>
          <div className="spec-breakdown">
            {Object.entries(analysis.match_result.matches).map(
              ([spec, matches]) => (
                <div
                  key={spec}
                  className={`spec-match ${matches ? "match" : "no-match"}`}
                >
                  <span className="spec-name">{spec.toUpperCase()}</span>
                  <span className="match-indicator">{matches ? "✓" : "✗"}</span>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderExpandedAnalysis = (): React.ReactElement | null => {
    if (!analysis?.found || !analysis.match_result) return null;

    return (
      <div className="style-analysis-expanded">
        <div
          className="expanded-header"
          onClick={toggleExpanded}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleExpanded();
            }
          }}
        >
          <h4>Style Analysis: {recipe?.style}</h4>
          <span className="collapse-indicator">▲</span>
        </div>

        <div className="style-match-result">
          <div
            className={`match-status ${getMatchStatusColor(
              analysis.match_result.matches
            )}`}
          >
            <span className="match-percentage">
              {Math.round(analysis.match_result.percentage)}% match
            </span>
            <span className="match-details">
              {getMatchStatusText(analysis.match_result.matches)}
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
                </div>
              )
            )}
          </div>

          {/* Visual range indicators for detailed analysis */}
          {analysis.style && metrics && (
            <div className="detailed-style-analysis">
              <h5>Detailed Style Compliance</h5>
              <div className="range-indicators">
                {analysis.style.original_gravity && (
                  <StyleRangeIndicator
                    metricType="og"
                    currentValue={metrics.og}
                    styleRange={analysis.style.original_gravity}
                    label="Original Gravity"
                  />
                )}

                {analysis.style.final_gravity && (
                  <StyleRangeIndicator
                    metricType="fg"
                    currentValue={metrics.fg}
                    styleRange={analysis.style.final_gravity}
                    label="Final Gravity"
                  />
                )}

                {analysis.style.alcohol_by_volume && (
                  <StyleRangeIndicator
                    metricType="abv"
                    currentValue={metrics.abv}
                    styleRange={analysis.style.alcohol_by_volume}
                    label="Alcohol by Volume"
                    unit="%"
                  />
                )}

                {analysis.style.international_bitterness_units && (
                  <StyleRangeIndicator
                    metricType="ibu"
                    currentValue={metrics.ibu}
                    styleRange={analysis.style.international_bitterness_units}
                    label="International Bitterness Units"
                  />
                )}

                {analysis.style.color && (
                  <StyleRangeIndicator
                    metricType="srm"
                    currentValue={metrics.srm}
                    styleRange={analysis.style.color}
                    label="Color (SRM)"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

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

      {/* Current Style Analysis - with collapsible view */}
      {recipe?.style && analysis && (
        <div className="current-style-analysis">
          {analysis.found ? (
            <div className="style-analysis-container">
              {/* Show compact or expanded view based on state */}
              {isExpanded ? renderExpandedAnalysis() : renderCompactAnalysis()}
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

      {/* Style suggestions - only show when no style is selected */}
      {!recipe?.style && suggestions.length > 0 && (
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
      {suggestions.length === 0 && !loading && !error && !recipe?.style && (
        <div className="no-suggestions">
          <p>
            No close style matches found. Your recipe may be a unique creation!
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