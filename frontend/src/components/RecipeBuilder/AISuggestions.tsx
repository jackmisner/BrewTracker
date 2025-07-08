import React, { useState, useEffect, useCallback } from "react";
import { Recipe, RecipeIngredient, RecipeMetrics } from "../../types";
import BeerStyleService from "../../services/BeerStyleService";

interface Suggestion {
  id: string;
  type: 'normalize' | 'hop_timing' | 'base_malt' | 'style_compliance' | 'yeast_selection';
  title: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
  changes: IngredientChange[];
}

interface IngredientChange {
  ingredientId: string;
  ingredientName: string;
  field: 'amount' | 'time' | 'use';
  currentValue: any;
  suggestedValue: any;
  reason: string;
}

interface AISuggestionsProps {
  recipe: Recipe;
  ingredients: RecipeIngredient[];
  metrics?: RecipeMetrics;
  onIngredientUpdate: (ingredientId: string, updatedData: Partial<RecipeIngredient>) => Promise<void>;
  disabled?: boolean;
}

const AISuggestions: React.FC<AISuggestionsProps> = ({
  recipe,
  ingredients,
  metrics,
  onIngredientUpdate,
  disabled = false
}) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Generate suggestions based on recipe analysis
  const generateSuggestions = useCallback(async (): Promise<void> => {
    if (!ingredients.length || !metrics) return;

    setLoading(true);
    const newSuggestions: Suggestion[] = [];

    try {
      // 1. Normalize ingredient amounts
      const normalizeAmountSuggestions = await generateNormalizeAmountSuggestions(ingredients);
      newSuggestions.push(...normalizeAmountSuggestions);

      // 2. Hop timing optimization
      const hopTimingSuggestions = await generateHopTimingSuggestions(ingredients, metrics);
      newSuggestions.push(...hopTimingSuggestions);

      // 3. Base malt validation
      const baseMaltSuggestions = await generateBaseMaltSuggestions(ingredients);
      newSuggestions.push(...baseMaltSuggestions);

      // 4. Style compliance suggestions
      if (recipe.style) {
        const styleComplianceSuggestions = await generateStyleComplianceSuggestions(
          recipe.style,
          ingredients,
          metrics
        );
        newSuggestions.push(...styleComplianceSuggestions);
      }

      // 5. Yeast selection improvements
      const yeastSuggestions = await generateYeastSuggestions(ingredients);
      newSuggestions.push(...yeastSuggestions);

      // Filter out already applied suggestions
      const filteredSuggestions = newSuggestions.filter(
        suggestion => !appliedSuggestions.has(suggestion.id)
      );

      setSuggestions(filteredSuggestions);
    } catch (error) {
      console.error('Error generating AI suggestions:', error);
    } finally {
      setLoading(false);
    }
  }, [ingredients, metrics, recipe.style, appliedSuggestions]);

  // Generate normalization suggestions
  const generateNormalizeAmountSuggestions = async (ingredients: RecipeIngredient[]): Promise<Suggestion[]> => {
    const suggestions: Suggestion[] = [];
    const changes: IngredientChange[] = [];

    ingredients.forEach(ingredient => {
      if (ingredient.type === 'grain' && ingredient.unit === 'lb') {
        const currentAmount = ingredient.amount;
        const normalizedAmount = Math.round(currentAmount * 4) / 4; // Round to nearest 0.25

        if (Math.abs(currentAmount - normalizedAmount) > 0.1) {
          changes.push({
            ingredientId: ingredient.id!,
            ingredientName: ingredient.name,
            field: 'amount',
            currentValue: currentAmount,
            suggestedValue: normalizedAmount,
            reason: 'Round to quarter-pound increments for easier measuring'
          });
        }
      } else if (ingredient.type === 'hop' && ingredient.unit === 'oz') {
        const currentAmount = ingredient.amount;
        const normalizedAmount = Math.round(currentAmount * 8) / 8; // Round to nearest 0.125

        if (Math.abs(currentAmount - normalizedAmount) > 0.05) {
          changes.push({
            ingredientId: ingredient.id!,
            ingredientName: ingredient.name,
            field: 'amount',
            currentValue: currentAmount,
            suggestedValue: normalizedAmount,
            reason: 'Round to eighth-ounce increments for easier measuring'
          });
        }
      }
    });

    if (changes.length > 0) {
      suggestions.push({
        id: 'normalize-amounts',
        type: 'normalize',
        title: 'Normalize Ingredient Amounts',
        description: `Round ${changes.length} ingredient amounts to brewing-friendly increments`,
        confidence: 'high',
        changes
      });
    }

    return suggestions;
  };

  // Generate hop timing suggestions
  const generateHopTimingSuggestions = async (ingredients: RecipeIngredient[], metrics: RecipeMetrics): Promise<Suggestion[]> => {
    const suggestions: Suggestion[] = [];
    const changes: IngredientChange[] = [];

    const hops = ingredients.filter(ingredient => ingredient.type === 'hop');
    
    hops.forEach(hop => {
      if (hop.use === 'boil' && hop.time !== undefined) {
        // Suggest converting late boil additions to whirlpool for better aroma
        if (hop.time <= 10 && hop.time > 0) {
          changes.push({
            ingredientId: hop.id!,
            ingredientName: hop.name,
            field: 'use',
            currentValue: 'boil',
            suggestedValue: 'whirlpool',
            reason: 'Late boil additions work better as whirlpool for aroma retention'
          });
        }
        // Suggest adjusting timing for overly bitter recipes
        else if (metrics.ibu > 60 && hop.time >= 45) {
          const newTime = Math.max(hop.time - 15, 20);
          changes.push({
            ingredientId: hop.id!,
            ingredientName: hop.name,
            field: 'time',
            currentValue: hop.time,
            suggestedValue: newTime,
            reason: `Reduce boil time to lower IBU from ${metrics.ibu.toFixed(1)} to target range`
          });
        }
      }
    });

    if (changes.length > 0) {
      suggestions.push({
        id: 'hop-timing-optimization',
        type: 'hop_timing',
        title: 'Optimize Hop Timing',
        description: `Improve hop schedule for better flavor and aroma balance`,
        confidence: 'medium',
        changes
      });
    }

    return suggestions;
  };

  // Generate base malt suggestions
  const generateBaseMaltSuggestions = async (ingredients: RecipeIngredient[]): Promise<Suggestion[]> => {
    const suggestions: Suggestion[] = [];
    const grains = ingredients.filter(ingredient => ingredient.type === 'grain');
    
    if (grains.length > 0) {
      const totalGrainWeight = grains.reduce((sum, grain) => sum + grain.amount, 0);
      const baseMalts = grains.filter(grain => grain.grain_type === 'base_malt');
      const baseMaltWeight = baseMalts.reduce((sum, grain) => sum + grain.amount, 0);
      const baseMaltPercentage = (baseMaltWeight / totalGrainWeight) * 100;

      if (baseMaltPercentage < 60) {
        suggestions.push({
          id: 'base-malt-percentage',
          type: 'base_malt',
          title: 'Increase Base Malt Percentage',
          description: `Current base malt: ${baseMaltPercentage.toFixed(1)}%. Consider increasing to 60%+ for better fermentability`,
          confidence: 'high',
          changes: [] // This would require more complex logic to suggest specific changes
        });
      }
    }

    return suggestions;
  };

  // Generate style compliance suggestions
  const generateStyleComplianceSuggestions = async (
    styleName: string,
    ingredients: RecipeIngredient[],
    metrics: RecipeMetrics
  ): Promise<Suggestion[]> => {
    const suggestions: Suggestion[] = [];
    
    try {
      const allStyles = await BeerStyleService.getAllStylesList();
      const targetStyle = allStyles.find(
        style => style.name.toLowerCase() === styleName.toLowerCase()
      );

      if (targetStyle) {
        const matchResult = BeerStyleService.calculateStyleMatch(targetStyle, metrics);
        const changes: IngredientChange[] = [];

        // Check IBU compliance
        if (targetStyle.international_bitterness_units && !matchResult.matches.ibu) {
          const currentIBU = metrics.ibu;
          
          if (currentIBU > targetStyle.international_bitterness_units?.maximum.value) {
            // Find bittering hops to reduce
            const bitteringHops = ingredients.filter(
              ingredient => ingredient.type === 'hop' && ingredient.use === 'boil' && (ingredient.time || 0) >= 45
            );
            
            bitteringHops.forEach(hop => {
              if (hop.time && hop.time > 30) {
                changes.push({
                  ingredientId: hop.id!,
                  ingredientName: hop.name,
                  field: 'time',
                  currentValue: hop.time,
                  suggestedValue: Math.max(hop.time - 15, 30),
                  reason: `Reduce IBU from ${currentIBU.toFixed(1)} to ${targetStyle.international_bitterness_units?.maximum.value} range`
                });
              }
            });
          }
        }

        if (changes.length > 0) {
          suggestions.push({
            id: 'style-compliance',
            type: 'style_compliance',
            title: `Improve ${styleName} Style Compliance`,
            description: `Adjust recipe to better match ${styleName} style guidelines`,
            confidence: 'medium',
            changes
          });
        }
      }
    } catch (error) {
      console.error('Error generating style compliance suggestions:', error);
    }

    return suggestions;
  };

  // Generate yeast selection suggestions
  const generateYeastSuggestions = async (ingredients: RecipeIngredient[]): Promise<Suggestion[]> => {
    const suggestions: Suggestion[] = [];
    const yeasts = ingredients.filter(ingredient => ingredient.type === 'yeast');
    
    yeasts.forEach(yeast => {
      if (yeast.improved_attenuation_estimate && yeast.attenuation) {
        const improvement = yeast.improved_attenuation_estimate - yeast.attenuation;
        if (improvement > 2) {
          suggestions.push({
            id: `yeast-${yeast.id}`,
            type: 'yeast_selection',
            title: 'Improved Yeast Attenuation Available',
            description: `${yeast.name} has improved attenuation data: ${yeast.improved_attenuation_estimate}% vs ${yeast.attenuation}%`,
            confidence: 'low',
            changes: [{
              ingredientId: yeast.id!,
              ingredientName: yeast.name,
              field: 'attenuation' as any,
              currentValue: yeast.attenuation,
              suggestedValue: yeast.improved_attenuation_estimate,
              reason: 'Use real-world attenuation data for better FG estimation'
            }]
          });
        }
      }
    });

    return suggestions;
  };

  // Apply a suggestion
  const applySuggestion = async (suggestion: Suggestion): Promise<void> => {
    if (disabled) return;

    try {
      for (const change of suggestion.changes) {
        const updateData: Partial<RecipeIngredient> = {
          [change.field]: change.suggestedValue
        };
        
        await onIngredientUpdate(change.ingredientId, updateData);
      }

      // Mark suggestion as applied
      setAppliedSuggestions(prev => new Set(prev).add(suggestion.id));
      
      // Remove from current suggestions
      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
    } catch (error) {
      console.error('Error applying suggestion:', error);
    }
  };

  // Dismiss a suggestion
  const dismissSuggestion = (suggestionId: string): void => {
    setAppliedSuggestions(prev => new Set(prev).add(suggestionId));
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
  };

  // Regenerate suggestions when ingredients or metrics change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      generateSuggestions();
    }, 1000); // Debounce for 1 second

    return () => clearTimeout(timeoutId);
  }, [generateSuggestions]);

  if (!suggestions.length && !loading) {
    return null;
  }

  return (
    <div className="ai-suggestions-card">
      <div className="ai-suggestions-header">
        <h3 className="ai-suggestions-title">
          🤖 AI Suggestions
          {loading && <span className="loading-spinner"></span>}
        </h3>
        <button 
          className="ai-suggestions-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? '−' : '+'}
        </button>
      </div>
      
      {isExpanded && (
        <div className="ai-suggestions-content">
          {suggestions.map(suggestion => (
            <div key={suggestion.id} className="ai-suggestion-item">
              <div className="ai-suggestion-header">
                <h4 className="ai-suggestion-title">{suggestion.title}</h4>
                <span className={`ai-suggestion-confidence ${suggestion.confidence}`}>
                  {suggestion.confidence}
                </span>
              </div>
              
              <p className="ai-suggestion-description">{suggestion.description}</p>
              
              {suggestion.changes.length > 0 && (
                <div className="ai-suggestion-changes">
                  {suggestion.changes.map((change, index) => (
                    <div key={index} className="ai-suggestion-change">
                      <span className="change-ingredient">{change.ingredientName}</span>
                      <span className="change-detail">
                        {change.field}: {change.currentValue} → {change.suggestedValue}
                      </span>
                      <span className="change-reason">{change.reason}</span>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="ai-suggestion-actions">
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={() => applySuggestion(suggestion)}
                  disabled={disabled || loading}
                >
                  Apply
                </button>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => dismissSuggestion(suggestion.id)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AISuggestions;