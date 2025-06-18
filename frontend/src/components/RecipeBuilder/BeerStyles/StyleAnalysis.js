import React, { useState, useEffect } from "react";
import BeerStyleService from "../../../services/BeerStyleService";
import {
  formatGravity,
  formatAbv,
  formatIbu,
  formatSrm,
} from "../../../utils/formatUtils";

function StyleAnalysis({ recipe, metrics, onStyleSuggestionSelect }) {
  const [analysis, setAnalysis] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (recipe?.recipe_id && metrics) {
      loadStyleAnalysis();
    } else if (metrics && !recipe?.recipe_id) {
      // For unsaved recipes, only load suggestions based on metrics
      loadStyleSuggestionsOnly();
    }
  }, [recipe?.recipe_id, metrics]);

  const loadStyleAnalysis = async () => {
    if (!recipe?.recipe_id) return;

    try {
      setLoading(true);
      setError(null);

      // Get style analysis and suggestions in parallel
      const [analysisResult, suggestionsResult] = await Promise.all([
        BeerStyleService.getRecipeStyleAnalysis(recipe.recipe_id).catch(
          (error) => {
            console.warn("Style analysis failed:", error);
            return null;
          }
        ),
        BeerStyleService.findMatchingStyles(metrics).catch((error) => {
          console.warn("Style suggestions failed:", error);
          return [];
        }),
      ]);

      setAnalysis(analysisResult);
      setSuggestions(suggestionsResult.slice(0, 5)); // Top 5 suggestions
    } catch (error) {
      console.error("Error loading style analysis:", error);
      setError("Failed to load style analysis");
    } finally {
      setLoading(false);
    }
  };

  const loadStyleSuggestionsOnly = async () => {
    try {
      setLoading(true);
      setError(null);

      const suggestionsResult = await BeerStyleService.findMatchingStyles(
        metrics
      );
      setSuggestions(suggestionsResult.slice(0, 5));
      setAnalysis(null); // No analysis for unsaved recipes
    } catch (error) {
      console.error("Error loading style suggestions:", error);
      setError("Failed to load style suggestions");
    } finally {
      setLoading(false);
    }
  };

  const getMatchStatusColor = (matches) => {
    const matchCount = Object.values(matches).filter(Boolean).length;
    const totalSpecs = Object.keys(matches).length;
    const percentage = totalSpecs > 0 ? (matchCount / totalSpecs) * 100 : 0;

    if (percentage >= 80) return "success";
    if (percentage >= 60) return "warning";
    return "danger";
  };

  const getMatchStatusText = (matches) => {
    const matchCount = Object.values(matches).filter(Boolean).length;
    const totalSpecs = Object.keys(matches).length;

    return `${matchCount}/${totalSpecs} specs match`;
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
          <p className="help-text">
            Style analysis requires a beer styles database. Please ensure beer
            styles are properly loaded in your system.
          </p>
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
          suggestions.
        </p>
      </div>
    );
  }

  return (
    <div className="style-analysis">
      <h3 className="analysis-title">Style Analysis</h3>

      {/* Current Style Analysis - only for saved recipes */}
      {recipe?.style && analysis && (
        <div className="current-style-analysis">
          <h4>Declared Style: {recipe.style}</h4>

          {analysis.found ? (
            <div className="style-match-result">
              <div
                className={`match-status ${getMatchStatusColor(
                  analysis.match_result.matches
                )}`}
              >
                <span className="match-percentage">
                  {Math.round(analysis.match_result.match_percentage)}% match
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
                      <span className="match-indicator">
                        {matches ? "✓" : "✗"}
                      </span>
                    </div>
                  )
                )}
              </div>

              {analysis.style_guide && (
                <div className="style-targets">
                  <h5>Style Targets</h5>
                  <div className="targets-grid">
                    {analysis.suggestions.og && (
                      <div className="target">
                        <span className="label">OG:</span>
                        <span className="value">
                          {formatGravity(analysis.suggestions.og)}
                        </span>
                      </div>
                    )}
                    {analysis.suggestions.fg && (
                      <div className="target">
                        <span className="label">FG:</span>
                        <span className="value">
                          {formatGravity(analysis.suggestions.fg)}
                        </span>
                      </div>
                    )}
                    {analysis.suggestions.abv && (
                      <div className="target">
                        <span className="label">ABV:</span>
                        <span className="value">
                          {formatAbv(analysis.suggestions.abv)}
                        </span>
                      </div>
                    )}
                    {analysis.suggestions.ibu && (
                      <div className="target">
                        <span className="label">IBU:</span>
                        <span className="value">
                          {formatIbu(analysis.suggestions.ibu)}
                        </span>
                      </div>
                    )}
                    {analysis.suggestions.srm && (
                      <div className="target">
                        <span className="label">SRM:</span>
                        <span className="value">
                          {formatSrm(analysis.suggestions.srm)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
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

      {/* Style Suggestions */}
      {suggestions.length > 0 && (
        <div className="style-suggestions">
          <h4>{recipe?.style ? "Alternative Styles" : "Suggested Styles"}</h4>
          <p className="suggestions-help">
            Based on your recipe's calculated metrics, these styles are good
            matches:
          </p>

          <div className="suggestions-list">
            {suggestions.map(({ style, match }) => (
              <div
                key={style.style_guide_id || style.style_id}
                className="suggestion-item"
              >
                <div className="suggestion-header">
                  <div className="style-info">
                    <span className="style-id">{style.style_id}</span>
                    <span className="style-name">{style.name}</span>
                  </div>
                  <div className="match-score">
                    {Math.round(match.percentage)}% match
                  </div>
                </div>

                <div className="suggestion-details">
                  <span className="category">{style.category_name}</span>
                  <div className="match-breakdown">
                    {Object.entries(match.matches).map(([spec, matches]) => (
                      <span
                        key={spec}
                        className={`spec-indicator ${
                          matches ? "match" : "no-match"
                        }`}
                      >
                        {spec.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>

                {onStyleSuggestionSelect && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onStyleSuggestionSelect(style.name)}
                  >
                    Use This Style
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No matches */}
      {suggestions.length === 0 && !loading && !error && (
        <div className="no-suggestions">
          <p>
            No close style matches found. Your recipe may be a unique creation!
          </p>
          <p className="help-text">
            Try adjusting your grain bill, hops, or yeast to move closer to a
            specific style.
          </p>
        </div>
      )}

      {/* Current metrics summary */}
      <div className="current-metrics-summary">
        <h5>Current Recipe Metrics</h5>
        <div className="metrics-grid">
          <div className="metric">
            <span className="label">OG:</span>
            <span className="value">{formatGravity(metrics.og)}</span>
          </div>
          <div className="metric">
            <span className="label">FG:</span>
            <span className="value">{formatGravity(metrics.fg)}</span>
          </div>
          <div className="metric">
            <span className="label">ABV:</span>
            <span className="value">{formatAbv(metrics.abv)}</span>
          </div>
          <div className="metric">
            <span className="label">IBU:</span>
            <span className="value">{formatIbu(metrics.ibu)}</span>
          </div>
          <div className="metric">
            <span className="label">SRM:</span>
            <span className="value">{formatSrm(metrics.srm)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StyleAnalysis;
