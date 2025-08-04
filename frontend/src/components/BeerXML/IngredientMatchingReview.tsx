import React, { useState, useEffect } from "react";
import { Services } from "../../services";
import ApiService from "../../services/api";
import { Ingredient, IngredientFormData } from "../../types";
import {
  IngredientMatchResult,
  IngredientMatchingDecision,
} from "../../types/beerxml";
import "../../styles/IngredientMatchingReview.css";

// Use types from beerxml.ts
type MatchingResult = IngredientMatchResult;
type Decision = IngredientMatchingDecision;

interface ReviewState {
  currentIndex: number;
  decisions: Decision[];
  isCreatingIngredients: boolean;
  error: string | null;
}

interface MatchingSummary {
  matched: number;
  newRequired: number;
  highConfidence: number;
}

interface IngredientMatchingReviewProps {
  matchingResults: MatchingResult[];
  onComplete: (result: any) => Promise<void>;
  onCancel: () => void;
}

const IngredientMatchingReview: React.FC<IngredientMatchingReviewProps> = ({
  matchingResults,
  onComplete,
  onCancel,
}) => {
  const [reviewState, setReviewState] = useState<ReviewState>({
    currentIndex: 0,
    decisions: [],
    isCreatingIngredients: false,
    error: null,
  });

  const [matchingSummary, setMatchingSummary] =
    useState<MatchingSummary | null>(null);

  useEffect(() => {
    // Initialize decisions array and calculate summary
    const decisions: Decision[] = matchingResults.map((result) => ({
      imported: result.imported,
      action:
        result.best_match || result.bestMatch ? "use_existing" : "create_new",
      selectedMatch:
        (result.best_match || result.bestMatch)?.ingredient || null,
      newIngredientData: result.suggestedIngredientData || null,
      confidence: result.confidence,
    }));

    setReviewState((prev) => ({ ...prev, decisions }));

    // Convert backend format to frontend format for summary calculation
    const normalizedResults = matchingResults.map((result) => ({
      ...result,
      bestMatch: result.best_match || result.bestMatch, // Normalize to frontend expected field
      requiresNewIngredient:
        result.requiresNewIngredient ||
        (result as any).requires_new ||
        (!result.best_match && !result.bestMatch),
    }));

    setMatchingSummary(
      Services.BeerXML.ingredientMatching.getMatchingSummary(
        normalizedResults as any[]
      )
    );
  }, [matchingResults]);

  /**
   * Update decision for current ingredient
   */
  const updateDecision = (
    action: "use_existing" | "create_new",
    selectedMatch: Ingredient | null = null,
    newIngredientData: IngredientFormData | null = null
  ): void => {
    setReviewState((prev) => ({
      ...prev,
      decisions: prev.decisions.map((decision, index) =>
        index === prev.currentIndex
          ? {
              ...decision,
              action,
              selectedMatch,
              newIngredientData:
                newIngredientData || decision.newIngredientData,
            }
          : decision
      ),
    }));
  };

  /**
   * Navigate to next ingredient
   */
  const goToNext = (): void => {
    setReviewState((prev) => ({
      ...prev,
      currentIndex: Math.min(prev.currentIndex + 1, matchingResults.length - 1),
    }));
  };

  /**
   * Navigate to previous ingredient
   */
  const goToPrevious = (): void => {
    setReviewState((prev) => ({
      ...prev,
      currentIndex: Math.max(prev.currentIndex - 1, 0),
    }));
  };

  /**
   * Complete the review process
   */
  const completeReview = async (): Promise<void> => {
    setReviewState((prev) => ({
      ...prev,
      isCreatingIngredients: true,
      error: null,
    }));

    try {
      const finalizedIngredients: any[] = [];
      const createdIngredients: Ingredient[] = []; // Track newly created ingredients
      const newIngredientCache = new Map<string, Ingredient>(); // Cache for created ingredients to prevent duplicates

      for (const decision of reviewState.decisions) {
        if (decision.action === "use_existing" && decision.selectedMatch) {
          // Use existing ingredient - fixed structure
          finalizedIngredients.push({
            id: `existing-${decision.selectedMatch.ingredient_id}`,
            ingredient_id: decision.selectedMatch.ingredient_id,
            name: decision.selectedMatch.name,
            type: decision.selectedMatch.type,
            amount: decision.imported.amount,
            unit: decision.imported.unit,
            use: decision.imported.use,
            time: decision.imported.time,
            // Include relevant properties from existing ingredient
            potential: decision.selectedMatch.potential,
            color: decision.selectedMatch.color,
            grain_type: decision.selectedMatch.grain_type,
            alpha_acid: decision.selectedMatch.alpha_acid,
            attenuation: decision.selectedMatch.attenuation,
          });
        } else if (
          decision.action === "create_new" &&
          decision.newIngredientData
        ) {
          // Create deduplication key based on name and type (case-insensitive)
          const dedupeKey = `${decision.newIngredientData.name
            .toLowerCase()
            .trim()}-${decision.newIngredientData.type}`;

          let newIngredient: Ingredient;
          if (newIngredientCache.has(dedupeKey)) {
            // Reuse already created ingredient
            newIngredient = newIngredientCache.get(dedupeKey)!;
          } else {
            // Create new ingredient
            newIngredient = await createNewIngredient(
              decision.newIngredientData
            );
            newIngredientCache.set(dedupeKey, newIngredient);
            createdIngredients.push(newIngredient); // Track for cache update only when actually created
          }

          // Add to finalized ingredients with complete structure
          finalizedIngredients.push({
            id: `new-${newIngredient.ingredient_id}`,
            ingredient_id: newIngredient.ingredient_id,
            name: newIngredient.name,
            type: newIngredient.type,
            amount: decision.imported.amount,
            unit: decision.imported.unit,
            use: decision.imported.use,
            time: decision.imported.time,
            // Include properties from new ingredient
            potential: newIngredient.potential,
            color: newIngredient.color,
            grain_type: newIngredient.grain_type,
            alpha_acid: newIngredient.alpha_acid,
            attenuation: newIngredient.attenuation,
          });
        }
      }

      // Pass both ingredients and created ingredients for cache updating
      await onComplete({
        ingredients: finalizedIngredients,
        createdIngredients: createdIngredients,
      });
    } catch (error: any) {
      console.error("Error completing review:", error);
      setReviewState((prev) => ({
        ...prev,
        error: error.message,
        isCreatingIngredients: false,
      }));
    }
  };

  /**
   * Create new ingredient via API
   */
  const createNewIngredient = async (
    ingredientData: IngredientFormData
  ): Promise<Ingredient> => {
    try {
      const response = await ApiService.ingredients.create(
        ingredientData as any
      );
      return response.data as unknown as Ingredient;
    } catch (error: any) {
      console.error("Error creating ingredient:", error);
      throw new Error(`Failed to create ingredient: ${ingredientData.name}`);
    }
  };

  /**
   * Skip to ingredient by index
   */
  const goToIngredient = (index: number): void => {
    setReviewState((prev) => ({ ...prev, currentIndex: index }));
  };

  /**
   * Get confidence color class
   */
  const getConfidenceClass = (confidence: number): string => {
    if (confidence > 0.8) return "confidence-high";
    if (confidence > 0.6) return "confidence-medium";
    return "confidence-low";
  };

  /**
   * Get confidence label
   */
  const getConfidenceLabel = (confidence: number): string => {
    if (confidence > 0.8) return "High";
    if (confidence > 0.6) return "Medium";
    return "Low";
  };

  if (!matchingResults.length || !reviewState.decisions.length) {
    return <div>Loading...</div>;
  }

  const currentResult = matchingResults[reviewState.currentIndex];
  const currentDecision = reviewState.decisions[reviewState.currentIndex];
  const progress =
    ((reviewState.currentIndex + 1) / matchingResults.length) * 100;

  return (
    <div className="ingredient-matching-review">
      {/* Header with progress */}
      <div className="review-header">
        <div className="review-title">
          <h2>Review Ingredient Matches</h2>
          <p>Review and approve ingredient matches before importing</p>
        </div>

        <div className="progress-info">
          <div className="progress-text">
            {reviewState.currentIndex + 1} of {matchingResults.length}
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {matchingSummary && (
        <div className="matching-summary">
          <div className="summary-stat">
            <span className="stat-value">{matchingSummary.matched}</span>
            <span className="stat-label">Matched</span>
          </div>
          <div className="summary-stat">
            <span className="stat-value">{matchingSummary.newRequired}</span>
            <span className="stat-label">New Required</span>
          </div>
          <div className="summary-stat">
            <span className="stat-value">{matchingSummary.highConfidence}</span>
            <span className="stat-label">High Confidence</span>
          </div>
        </div>
      )}

      {/* Main Review Content */}
      <div className="review-content">
        {/* Imported Ingredient Info */}
        <div className="imported-ingredient">
          <h3>Imported Ingredient</h3>
          <div className="ingredient-card imported">
            <div className="ingredient-header">
              <span className={`type-badge ${currentResult.imported.type}`}>
                {currentResult.imported.type}
              </span>
              <h4>{currentResult.imported.name}</h4>
            </div>

            <div className="ingredient-details">
              <div className="detail-item">
                <span className="label">Amount:</span>
                <span className="value">
                  {currentResult.imported.amount} {currentResult.imported.unit}
                </span>
              </div>

              {currentResult.imported.use && (
                <div className="detail-item">
                  <span className="label">Use:</span>
                  <span className="value">{currentResult.imported.use}</span>
                </div>
              )}

              {currentResult.imported.alpha_acid && (
                <div className="detail-item">
                  <span className="label">Alpha Acid:</span>
                  <span className="value">
                    {currentResult.imported.alpha_acid}%
                  </span>
                </div>
              )}

              {currentResult.imported.color && (
                <div className="detail-item">
                  <span className="label">Color:</span>
                  <span className="value">
                    {currentResult.imported.color}°L
                  </span>
                </div>
              )}

              {currentResult.imported.attenuation && (
                <div className="detail-item">
                  <span className="label">Attenuation:</span>
                  <span className="value">
                    {currentResult.imported.attenuation}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Matching Options */}
        <div className="matching-options">
          <h3>Matching Options</h3>

          {/* Use Existing Match */}
          {currentResult.matches.length > 0 && (
            <div className="option-section">
              <div className="option-header">
                <input
                  type="radio"
                  id="use-existing"
                  name="match-option"
                  checked={currentDecision.action === "use_existing"}
                  onChange={() =>
                    updateDecision(
                      "use_existing",
                      currentResult.best_match?.ingredient // Fixed: use best_match
                    )
                  }
                />
                <label htmlFor="use-existing">Use Existing Ingredient</label>
              </div>

              <div className="matches-list">
                {currentResult.matches.slice(0, 3).map((match, index) => (
                  <div
                    key={index}
                    className={`match-item ${
                      currentDecision.selectedMatch?.ingredient_id ===
                      match.ingredient.ingredient_id
                        ? "selected"
                        : ""
                    }`}
                    onClick={() =>
                      updateDecision("use_existing", match.ingredient)
                    }
                  >
                    <div className="match-header">
                      <span className="match-name">
                        {match.ingredient.name}
                      </span>
                      <div
                        className={`confidence-badge ${getConfidenceClass(
                          match.confidence
                        )}`}
                      >
                        <span className="confidence-dot" />
                        {getConfidenceLabel(match.confidence)} (
                        {(match.confidence * 100).toFixed(0)}%)
                      </div>
                    </div>

                    <div className="match-details">
                      {match.ingredient.alpha_acid && (
                        <span className="detail">
                          AA: {match.ingredient.alpha_acid}%
                        </span>
                      )}
                      {match.ingredient.color && (
                        <span className="detail">
                          Color: {match.ingredient.color}°L
                        </span>
                      )}
                      {(match.ingredient.improved_attenuation_estimate ||
                        match.ingredient.attenuation) && (
                        <span className="detail">
                          Att:{" "}
                          {match.ingredient.improved_attenuation_estimate ||
                            match.ingredient.attenuation}
                          %
                          {match.ingredient.improved_attenuation_estimate && (
                            <span title="Enhanced estimate">📊</span>
                          )}
                        </span>
                      )}
                    </div>

                    {match.reasons.length > 0 && (
                      <div className="match-reasons">
                        {match.reasons.map((reason, idx) => (
                          <span key={idx} className="reason-tag">
                            {reason}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Create New Ingredient */}
          <div className="option-section">
            <div className="option-header">
              <input
                type="radio"
                id="create-new"
                name="match-option"
                checked={currentDecision.action === "create_new"}
                onChange={() => updateDecision("create_new")}
              />
              <label htmlFor="create-new">Create New Ingredient</label>
            </div>

            {currentDecision.action === "create_new" &&
              currentDecision.newIngredientData && (
                <div className="new-ingredient-preview">
                  <div className="preview-header">
                    <span>
                      New ingredient will be created with these properties:
                    </span>
                  </div>
                  <div className="preview-details">
                    <div className="detail-item">
                      <span className="label">Name:</span>
                      <span className="value">
                        {currentDecision.newIngredientData?.name}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Type:</span>
                      <span className="value">
                        {currentDecision.newIngredientData?.type}
                      </span>
                    </div>
                    {currentDecision.newIngredientData?.alpha_acid && (
                      <div className="detail-item">
                        <span className="label">Alpha Acid:</span>
                        <span className="value">
                          {currentDecision.newIngredientData.alpha_acid}%
                        </span>
                      </div>
                    )}
                    {currentDecision.newIngredientData?.color && (
                      <div className="detail-item">
                        <span className="label">Color:</span>
                        <span className="value">
                          {currentDecision.newIngredientData.color}°L
                        </span>
                      </div>
                    )}
                    {currentDecision.newIngredientData?.attenuation && (
                      <div className="detail-item">
                        <span className="label">Attenuation:</span>
                        <span className="value">
                          {currentDecision.newIngredientData.attenuation}%
                        </span>
                      </div>
                    )}
                    {currentDecision.newIngredientData?.grain_type && (
                      <div className="detail-item">
                        <span className="label">Grain Type:</span>
                        <span className="value">
                          {currentDecision.newIngredientData.grain_type}
                        </span>
                      </div>
                    )}
                    {currentDecision.newIngredientData?.manufacturer && (
                      <div className="detail-item">
                        <span className="label">Manufacturer:</span>
                        <span className="value">
                          {currentDecision.newIngredientData.manufacturer}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="review-navigation">
        <div className="nav-buttons">
          <button
            onClick={goToPrevious}
            disabled={reviewState.currentIndex === 0}
            className="btn btn-secondary"
          >
            ← Previous
          </button>

          <div className="ingredient-navigator">
            {matchingResults.map((_, index) => (
              <button
                key={index}
                onClick={() => goToIngredient(index)}
                className={`nav-dot ${
                  index === reviewState.currentIndex ? "active" : ""
                } ${
                  reviewState.decisions[index]?.action === "use_existing"
                    ? "matched"
                    : "new"
                }`}
                title={`${matchingResults[index].imported.name} - ${
                  reviewState.decisions[index]?.action === "use_existing"
                    ? "Matched"
                    : "New"
                }`}
              />
            ))}
          </div>

          <button
            onClick={goToNext}
            disabled={reviewState.currentIndex === matchingResults.length - 1}
            className="btn btn-secondary"
          >
            Next →
          </button>
        </div>

        <div className="action-buttons">
          <button
            onClick={onCancel}
            className="btn btn-outline"
            disabled={reviewState.isCreatingIngredients}
          >
            Cancel
          </button>

          <button
            onClick={completeReview}
            disabled={reviewState.isCreatingIngredients}
            className="btn btn-primary"
          >
            {reviewState.isCreatingIngredients ? (
              <>
                <span className="button-spinner"></span>
                Creating Ingredients...
              </>
            ) : (
              "Complete Import"
            )}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {reviewState.error && (
        <div className="error-message">
          <div className="error-icon">⚠️</div>
          <div className="error-text">{reviewState.error}</div>
        </div>
      )}
    </div>
  );
};

export default IngredientMatchingReview;
