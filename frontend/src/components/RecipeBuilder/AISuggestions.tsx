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

    console.log('Generating suggestions for ingredients:', ingredients);
    console.log('Recipe metrics:', metrics);

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
      if (ingredient.type === 'grain') {
        const currentAmount = ingredient.amount;
        let normalizedAmount = currentAmount;
        let threshold = 0.01;
        let reason = '';

        switch (ingredient.unit.toLowerCase()) {
          case 'lb':
            normalizedAmount = Math.round(currentAmount * 4) / 4; // Quarter pounds
            threshold = 0.1;
            reason = 'Round to quarter-pound increments for easier measuring';
            break;
          case 'kg':
            normalizedAmount = Math.round(currentAmount * 10) / 10; // Tenth kg
            threshold = 0.05;
            reason = 'Round to tenth-kilogram increments for easier measuring';
            break;
          case 'g':
            normalizedAmount = Math.round(currentAmount / 10) * 10; // 10g increments
            threshold = 5;
            reason = 'Round to 10-gram increments for easier measuring';
            break;
          case 'oz':
            normalizedAmount = Math.round(currentAmount * 8) / 8; // Eighth ounces
            threshold = 0.05;
            reason = 'Round to eighth-ounce increments for easier measuring';
            break;
        }

        if (Math.abs(currentAmount - normalizedAmount) > threshold) {
          changes.push({
            ingredientId: ingredient.id!,
            ingredientName: ingredient.name,
            field: 'amount',
            currentValue: currentAmount,
            suggestedValue: normalizedAmount,
            reason
          });
        }
      } else if (ingredient.type === 'hop') {
        const currentAmount = ingredient.amount;
        let normalizedAmount = currentAmount;
        let threshold = 0.01;
        let reason = '';

        switch (ingredient.unit.toLowerCase()) {
          case 'oz':
            normalizedAmount = Math.round(currentAmount * 8) / 8; // Eighth ounces
            threshold = 0.05;
            reason = 'Round to eighth-ounce increments for easier measuring';
            break;
          case 'g':
            normalizedAmount = Math.round(currentAmount / 5) * 5; // 5g increments
            threshold = 2;
            reason = 'Round to 5-gram increments for easier measuring';
            break;
        }

        if (Math.abs(currentAmount - normalizedAmount) > threshold) {
          changes.push({
            ingredientId: ingredient.id!,
            ingredientName: ingredient.name,
            field: 'amount',
            currentValue: currentAmount,
            suggestedValue: normalizedAmount,
            reason
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

  // Helper function to convert grain weight to pounds
  const convertToPounds = (amount: number, unit: string): number => {
    switch (unit.toLowerCase()) {
      case 'g':
        return amount * 0.00220462; // grams to pounds
      case 'kg':
        return amount * 2.20462; // kilograms to pounds
      case 'oz':
        return amount / 16; // ounces to pounds
      case 'lb':
      default:
        return amount; // already in pounds
    }
  };

  // Generate base malt suggestions
  const generateBaseMaltSuggestions = async (ingredients: RecipeIngredient[]): Promise<Suggestion[]> => {
    const suggestions: Suggestion[] = [];
    const grains = ingredients.filter(ingredient => ingredient.type === 'grain');
    
    if (grains.length > 0) {
      // Convert all grain weights to pounds for consistent calculation
      const totalGrainWeight = grains.reduce((sum, grain) => {
        return sum + convertToPounds(grain.amount, grain.unit);
      }, 0);
      
      const baseMalts = grains.filter(grain => grain.grain_type === 'base_malt');
      const baseMaltWeight = baseMalts.reduce((sum, grain) => {
        return sum + convertToPounds(grain.amount, grain.unit);
      }, 0);
      
      const baseMaltPercentage = (baseMaltWeight / totalGrainWeight) * 100;

      // Debug logging
      console.log('Base malt analysis:', {
        totalGrains: grains.length,
        totalGrainWeight,
        baseMalts: baseMalts.map(g => ({ name: g.name, amount: g.amount, grain_type: g.grain_type })),
        baseMaltWeight,
        baseMaltPercentage
      });

      if (baseMaltPercentage < 60 && baseMaltPercentage > 0) {
        // Generate actual changes - suggest increasing the largest base malt
        const changes: IngredientChange[] = [];
        const largestBaseMalt = baseMalts.reduce((largest, current) => {
          const currentWeightInPounds = convertToPounds(current.amount, current.unit);
          const largestWeightInPounds = convertToPounds(largest.amount, largest.unit);
          return currentWeightInPounds > largestWeightInPounds ? current : largest;
        }, baseMalts[0]);
        
        if (largestBaseMalt) {
          const targetBaseMaltPercentage = 65; // Target 65% base malt
          const targetBaseMaltWeight = (targetBaseMaltPercentage / 100) * totalGrainWeight;
          const additionalBaseMalt = targetBaseMaltWeight - baseMaltWeight;
          
          // Convert the additional amount back to the original unit of the largest base malt
          let additionalInOriginalUnit = additionalBaseMalt;
          if (largestBaseMalt.unit.toLowerCase() === 'kg') {
            additionalInOriginalUnit = additionalBaseMalt / 2.20462;
          } else if (largestBaseMalt.unit.toLowerCase() === 'g') {
            additionalInOriginalUnit = additionalBaseMalt / 0.00220462;
          } else if (largestBaseMalt.unit.toLowerCase() === 'oz') {
            additionalInOriginalUnit = additionalBaseMalt * 16;
          }
          
          const newAmount = largestBaseMalt.amount + additionalInOriginalUnit;
          
          // Round appropriately based on unit
          let roundedAmount = newAmount;
          if (largestBaseMalt.unit.toLowerCase() === 'lb') {
            roundedAmount = Math.round(newAmount * 4) / 4; // Quarter pounds
          } else if (largestBaseMalt.unit.toLowerCase() === 'kg') {
            roundedAmount = Math.round(newAmount * 10) / 10; // Tenth kg
          } else if (largestBaseMalt.unit.toLowerCase() === 'g') {
            roundedAmount = Math.round(newAmount / 10) * 10; // 10g increments
          } else if (largestBaseMalt.unit.toLowerCase() === 'oz') {
            roundedAmount = Math.round(newAmount * 8) / 8; // Eighth ounces
          }
          
          changes.push({
            ingredientId: largestBaseMalt.id!,
            ingredientName: largestBaseMalt.name,
            field: 'amount',
            currentValue: largestBaseMalt.amount,
            suggestedValue: roundedAmount,
            reason: `Increase base malt from ${baseMaltPercentage.toFixed(1)}% to ${targetBaseMaltPercentage}% for better fermentability`
          });
        }

        suggestions.push({
          id: 'base-malt-percentage',
          type: 'base_malt',
          title: 'Increase Base Malt Percentage',
          description: `Current base malt: ${baseMaltPercentage.toFixed(1)}%. Consider increasing to 60%+ for better fermentability`,
          confidence: 'medium',
          changes
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

    console.log('Applying suggestion:', suggestion);

    try {
      for (const change of suggestion.changes) {
        console.log('Applying change:', change);
        
        const updateData: Partial<RecipeIngredient> = {
          [change.field]: change.suggestedValue
        };
        
        console.log('Update data:', updateData);
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