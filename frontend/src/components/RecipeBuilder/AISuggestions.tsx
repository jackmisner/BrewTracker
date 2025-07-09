import React, { useState, useEffect, useCallback } from "react";
import { Recipe, RecipeIngredient, RecipeMetrics } from "../../types";
import { BeerStyleGuide } from "../../types/beer-styles";
import BeerStyleService from "../../services/BeerStyleService";
import CascadingEffectsService, { CascadingEffects } from "../../services/CascadingEffectsService";
import SmartBaseMaltService from "../../services/SmartBaseMaltService";
import EnhancedStyleComplianceService, { StyleCharacteristics, StyleOptimizationTarget } from "../../services/EnhancedStyleComplianceService";
import { useUnits } from "../../contexts/UnitContext";
import { formatIngredientAmount } from "../../utils/formatUtils";



interface Suggestion {
  id: string;
  type: 'normalize' | 'hop_timing' | 'base_malt' | 'style_compliance' | 'yeast_selection';
  title: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
  changes: IngredientChange[];
  cascadingEffects?: CascadingEffects;
  priority?: number;
  styleImpact?: string;
  impactType?: 'critical' | 'important' | 'nice-to-have';
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
  onBulkIngredientUpdate: (updates: Array<{ ingredientId: string; updatedData: Partial<RecipeIngredient> }>) => Promise<void>;
  disabled?: boolean;
}

const AISuggestions: React.FC<AISuggestionsProps> = ({
  recipe,
  ingredients,
  metrics,
  onBulkIngredientUpdate,
  disabled = false
}) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [selectedStyleGuide, setSelectedStyleGuide] = useState<BeerStyleGuide | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState<boolean>(false);
  
  // Service instances
  const cascadingEffectsService = new CascadingEffectsService();
  const smartBaseMaltService = new SmartBaseMaltService();
  const enhancedStyleComplianceService = new EnhancedStyleComplianceService();
  
  // Unit context for user preferences
  const { unitSystem } = useUnits();
  


  // Load the selected style guide when recipe style changes
  const loadSelectedStyleGuide = useCallback(async (): Promise<void> => {
    if (!recipe.style) {
      setSelectedStyleGuide(null);
      return;
    }

    try {
      const allStyles = await BeerStyleService.getAllStylesList();
      const foundStyle = allStyles.find(
        (style: any) =>
          style.name.toLowerCase() === recipe.style!.toLowerCase() ||
          style.display_name?.toLowerCase() === recipe.style!.toLowerCase()
      );
      
      setSelectedStyleGuide(foundStyle || null);
    } catch (error) {
      console.error('Error loading style guide:', error);
      setSelectedStyleGuide(null);
    }
  }, [recipe.style]);

  // Load style guide when recipe style changes
  useEffect(() => {
    loadSelectedStyleGuide();
  }, [loadSelectedStyleGuide]);

  // Generate cohesive suggestions based on recipe analysis
  const generateCohesiveSuggestions = useCallback(async (): Promise<void> => {
    if (!ingredients.length || !metrics) return;
    
    // Ensure metrics is defined for TypeScript
    const currentMetrics = metrics;

    console.log('Generating cohesive suggestions for ingredients:', ingredients);
    console.log('Recipe metrics:', metrics);

    setAnalyzing(true);
    const cohesiveSuggestions: Suggestion[] = [];

    try {
      // PHASE 1: Base malt analysis (most important for fermentation)
      const baseMaltSuggestions = await generateBaseMaltSuggestions(ingredients, currentMetrics);
      
      // PHASE 2: Style compliance (after base malt is adequate)
      let styleComplianceSuggestions: Suggestion[] = [];
      if (selectedStyleGuide) {
        styleComplianceSuggestions = await generateStyleComplianceSuggestionsFromStyleGuide(
          selectedStyleGuide,
          ingredients,
          currentMetrics
        );
      } else if (recipe.style) {
        styleComplianceSuggestions = await generateStyleComplianceSuggestions(
          recipe.style,
          ingredients,
          currentMetrics
        );
      }

      // PHASE 3: Secondary improvements
      const normalizeAmountSuggestions = await generateNormalizeAmountSuggestions(ingredients);
      const hopTimingSuggestions = await generateHopTimingSuggestions(ingredients, currentMetrics);
      const yeastSuggestions = await generateYeastSuggestions(ingredients);



      // Create a single comprehensive suggestion combining ALL optimizations
      const allChanges: IngredientChange[] = [];
      const suggestionBreakdown: string[] = [];
      
      // Group suggestions by category for better organization
      const baseMaltChanges = baseMaltSuggestions.flatMap(s => s.changes);
      const styleComplianceChanges = styleComplianceSuggestions.flatMap(s => s.changes);
      const hopTimingChanges = hopTimingSuggestions.flatMap(s => s.changes);
      const yeastChanges = yeastSuggestions.flatMap(s => s.changes);
      const normalizationChanges = normalizeAmountSuggestions.flatMap(s => s.changes);
      
      // Debug output to see what each category is generating
      // console.log('Base malt changes:', baseMaltChanges.length, baseMaltChanges);
      // console.log('Style compliance changes:', styleComplianceChanges.length, styleComplianceChanges);
      // console.log('Hop timing changes:', hopTimingChanges.length, hopTimingChanges);
      // console.log('Yeast changes:', yeastChanges.length, yeastChanges);
      // console.log('Normalization changes:', normalizationChanges.length, normalizationChanges);
      
      // Add changes in priority order with conflict resolution
      const allChangeCategories = [
        { changes: baseMaltChanges, description: 'Base Malt Optimization', priority: 3 },
        { changes: styleComplianceChanges, description: 'Style Compliance', priority: 2 },
        { changes: hopTimingChanges, description: 'Hop Timing Optimization', priority: 1 },
        { changes: yeastChanges, description: 'Yeast Selection', priority: 1 },
        { changes: normalizationChanges, description: 'Amount Normalization', priority: 0 }
      ];
      
      // Smart merge: resolve conflicts and combine changes
      const mergedChanges = mergeIngredientChanges(allChangeCategories);
      allChanges.push(...mergedChanges);
      
      // Build detailed description
      let description = selectedStyleGuide ? 
        `Complete recipe optimization for ${selectedStyleGuide.name} style` : 
        'Comprehensive recipe optimization';
      
      // Add breakdown of what's being optimized
      if (baseMaltChanges.length > 0) {
        suggestionBreakdown.push(`Base malt selection and proportions (${baseMaltChanges.length} ${baseMaltChanges.length === 1 ? 'change' : 'changes'})`);
      }
      if (styleComplianceChanges.length > 0) {
        suggestionBreakdown.push(`Style compliance optimization (${styleComplianceChanges.length} ${styleComplianceChanges.length === 1 ? 'adjustment' : 'adjustments'})`);
      }
      if (hopTimingChanges.length > 0) {
        suggestionBreakdown.push(`Hop timing optimization (${hopTimingChanges.length} ${hopTimingChanges.length === 1 ? 'change' : 'changes'})`);
      }
      if (yeastChanges.length > 0) {
        suggestionBreakdown.push(`Yeast selection improvements (${yeastChanges.length} ${yeastChanges.length === 1 ? 'change' : 'changes'})`);
      }
      if (normalizationChanges.length > 0) {
        suggestionBreakdown.push(`Ingredient measurement normalization (${normalizationChanges.length} ${normalizationChanges.length === 1 ? 'amount' : 'amounts'})`);
      }
      
      if (suggestionBreakdown.length > 0) {
        description += `\n\nThis comprehensive optimization includes:\n• ${suggestionBreakdown.join('\n• ')}`;
        
        // Add total change count
        const totalChanges = allChanges.length;
        description += `\n\nTotal ingredient adjustments: ${totalChanges}`;
      }
      
      // Only create suggestion if we have meaningful changes
      if (allChanges.length > 0) {
        // Calculate cascading effects for the combined changes
        let cascadingEffects: CascadingEffects | undefined;
        try {
          cascadingEffects = await cascadingEffectsService.calculateCascadingEffects(
            recipe,
            ingredients,
            allChanges,
            currentMetrics
          );
        } catch (error) {
          console.warn('Failed to calculate cascading effects:', error);
        }

        // Determine overall impact and confidence
        const hasStyleCompliance = styleComplianceChanges.length > 0;
        const hasBaseMaltOptimization = baseMaltChanges.length > 0;
        const changeCount = allChanges.length;
        
        const impactType = hasStyleCompliance || hasBaseMaltOptimization ? 'critical' : 
                          hopTimingChanges.length > 0 ? 'important' : 'nice-to-have';
        
        const confidence = changeCount >= 3 ? 'high' : changeCount >= 2 ? 'medium' : 'low';
        
        cohesiveSuggestions.push({
          id: 'comprehensive-recipe-optimization',
          type: 'style_compliance',
          title: 'Complete Recipe Optimization',
          description,
          confidence,
          changes: allChanges,
          cascadingEffects,
          priority: hasStyleCompliance ? 3 : hasBaseMaltOptimization ? 2 : 1,
          impactType,
          styleImpact: selectedStyleGuide ? 
            `Optimizes recipe for ${selectedStyleGuide.name} style characteristics` : 
            'Improves overall recipe quality and brewing accuracy'
        });
      }

      // Filter out already applied suggestions
      const filteredSuggestions = cohesiveSuggestions.filter(
        suggestion => !appliedSuggestions.has(suggestion.id)
      );

      setSuggestions(filteredSuggestions);
      setHasAnalyzed(true);
    } catch (error) {
      console.error('Error generating cohesive suggestions:', error);
    } finally {
      setAnalyzing(false);
    }
  }, [ingredients, metrics, recipe.style, selectedStyleGuide, appliedSuggestions, recipe, cascadingEffectsService]);

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
            if (currentAmount >= 1000) {
              normalizedAmount = Math.round(currentAmount / 50) * 50; // 50g increments for large amounts
              threshold = 25;
              reason = 'Round to 50-gram increments for easier measuring';
            } else if (currentAmount >= 100) {
              normalizedAmount = Math.round(currentAmount / 10) * 10; // 10g increments
              threshold = 5;
              reason = 'Round to 10-gram increments for easier measuring';
            } else {
              normalizedAmount = Math.round(currentAmount * 2) / 2; // 0.5g increments
              threshold = 0.25;
              reason = 'Round to 0.5-gram increments for easier measuring';
            }
            break;
          case 'oz':
            normalizedAmount = Math.round(currentAmount * 8) / 8; // Eighth ounces
            threshold = 0.05;
            reason = 'Round to eighth-ounce increments for easier measuring';
            break;
        }

        // Only suggest if the change is meaningful and the normalized value is different
        if (Math.abs(currentAmount - normalizedAmount) > threshold && normalizedAmount !== currentAmount) {
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
            if (currentAmount >= 10) {
              normalizedAmount = Math.round(currentAmount / 5) * 5; // 5g increments
              threshold = 2;
              reason = 'Round to 5-gram increments for easier measuring';
            } else {
              normalizedAmount = Math.round(currentAmount * 2) / 2; // 0.5g increments
              threshold = 0.25;
              reason = 'Round to 0.5-gram increments for easier measuring';
            }
            break;
        }

        // Only suggest if the change is meaningful and the normalized value is different
        if (Math.abs(currentAmount - normalizedAmount) > threshold && normalizedAmount !== currentAmount) {
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
        changes,
        priority: 0.5, // Low priority - nice to have
        impactType: 'nice-to-have',
        styleImpact: 'Improves recipe consistency and measuring accuracy'
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
        // Suggest optimizing hop timing for better flavor/aroma balance
        else if (hop.time === 60 && metrics.ibu < 40) {
          // For low IBU recipes, suggest some later additions for flavor
          changes.push({
            ingredientId: hop.id!,
            ingredientName: hop.name,
            field: 'time',
            currentValue: hop.time,
            suggestedValue: 20,
            reason: 'Add some later boil additions for better hop flavor and aroma'
          });
        }
        // Suggest normalizing hop timing to common intervals
        else if (hop.time && ![0, 5, 10, 15, 20, 30, 45, 60].includes(hop.time)) {
          const standardTimes = [0, 5, 10, 15, 20, 30, 45, 60];
          const closestTime = standardTimes.reduce((prev, curr) => 
            Math.abs(curr - hop.time!) < Math.abs(prev - hop.time!) ? curr : prev
          );
          
          if (Math.abs(hop.time - closestTime) <= 5) {
            changes.push({
              ingredientId: hop.id!,
              ingredientName: hop.name,
              field: 'time',
              currentValue: hop.time,
              suggestedValue: closestTime,
              reason: `Normalize to standard ${closestTime}-minute boil time for consistency`
            });
          }
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
        changes,
        priority: 1, // Medium priority
        impactType: 'important',
        styleImpact: 'Improves hop flavor balance and aroma retention'
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

  // Helper function to normalize amounts based on unit and user preferences
  const normalizeAmountForUnit = (amount: number, unit: string): number => {
    // Validate input
    if (!isFinite(amount) || amount <= 0) {
      return amount; // Return original if invalid
    }
    
    switch (unit.toLowerCase()) {
      case 'lb':
        return Math.round(amount * 4) / 4; // Quarter pounds
      case 'kg':
        return Math.round(amount * 10) / 10; // Tenth kg
      case 'g':
        // For metric users, round to brewing-friendly increments
        if (amount >= 100) {
          return Math.round(amount / 10) * 10; // 10g increments for larger amounts
        } else if (amount >= 10) {
          return Math.round(amount / 5) * 5; // 5g increments for medium amounts
        } else {
          return Math.round(amount * 2) / 2; // 0.5g increments for smaller amounts
        }
      case 'oz':
        if (amount >= 2) {
          return Math.round(amount * 4) / 4; // Quarter ounces for larger amounts
        } else {
          return Math.round(amount * 8) / 8; // Eighth ounces for smaller amounts
        }
      default:
        return amount;
    }
  };

  // Smart merge function to resolve conflicts and combine ingredient changes
  const mergeIngredientChanges = (changeCategories: Array<{ changes: IngredientChange[], description: string, priority: number }>): IngredientChange[] => {
    const mergedChanges: IngredientChange[] = [];
    const processedIngredients = new Set<string>();
    
    // Sort categories by priority (highest first)
    const sortedCategories = changeCategories.sort((a, b) => b.priority - a.priority);
    
    // Process each category in priority order
    for (const category of sortedCategories) {
      for (const change of category.changes) {
        const key = `${change.ingredientId}-${change.field}`;
        
        // Skip if we've already processed this ingredient field
        if (processedIngredients.has(key)) {
          continue;
        }
        
        // Add change and mark as processed
        mergedChanges.push(change);
        processedIngredients.add(key);
      }
    }
    
    return mergedChanges;
  };

  // Generate base malt suggestions with smart selection
  const generateBaseMaltSuggestions = async (ingredients: RecipeIngredient[], currentMetrics: RecipeMetrics): Promise<Suggestion[]> => {
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
        // Use smart base malt selection to determine which malts to increase
        const smartSelection = selectedStyleGuide 
          ? await smartBaseMaltService.selectBaseMaltsForIncreaseFromStyleGuide(
              selectedStyleGuide,
              ingredients,
              baseMalts
            )
          : await smartBaseMaltService.selectBaseMaltsForIncrease(
              recipe,
              ingredients,
              baseMalts
            );
        
        // Get smart recommendations for context
        const recommendations = selectedStyleGuide
          ? await smartBaseMaltService.getSmartBaseMaltRecommendationsFromStyleGuide(
              selectedStyleGuide,
              ingredients
            )
          : await smartBaseMaltService.getSmartBaseMaltRecommendations(
              recipe,
              ingredients
            );
        
        // Generate actual changes - increase selected base malts proportionally
        const changes: IngredientChange[] = [];
        const targetBaseMaltPercentage = 65; // Target 65% base malt
        const targetBaseMaltWeight = (targetBaseMaltPercentage / 100) * totalGrainWeight;
        
        // Calculate the scaling factor needed to reach target base malt percentage
        const scalingFactor = targetBaseMaltWeight / baseMaltWeight;
        
        // Apply scaling factor to smart-selected base malts
        const maltsToIncrease = smartSelection.length > 0 ? smartSelection : baseMalts;
        const topRecommendation = recommendations.length > 0 ? recommendations[0] : null;
        
        maltsToIncrease.forEach(baseMalt => {
          const newAmount = baseMalt.amount * scalingFactor;
          
          // Normalize both current and suggested amounts to brewing-friendly increments
          let normalizedCurrentAmount = baseMalt.amount;
          let normalizedAmount = newAmount;
          switch (baseMalt.unit.toLowerCase()) {
            case 'lb':
              normalizedCurrentAmount = Math.round(baseMalt.amount * 4) / 4; // Quarter pounds
              normalizedAmount = Math.round(newAmount * 4) / 4; // Quarter pounds
              break;
            case 'kg':
              normalizedCurrentAmount = Math.round(baseMalt.amount * 10) / 10; // Tenth kg
              normalizedAmount = Math.round(newAmount * 10) / 10; // Tenth kg
              break;
            case 'g':
              normalizedCurrentAmount = Math.round(baseMalt.amount / 10) * 10; // 10g increments
              normalizedAmount = Math.round(newAmount / 10) * 10; // 10g increments
              break;
            case 'oz':
              normalizedCurrentAmount = Math.round(baseMalt.amount * 8) / 8; // Eighth ounces
              normalizedAmount = Math.round(newAmount * 8) / 8; // Eighth ounces
              break;
          }
          
          // Only suggest changes if the difference is meaningful (adjusted for unit)
          let threshold;
          switch (baseMalt.unit.toLowerCase()) {
            case 'g':
              threshold = 5; // 5g threshold for grams
              break;
            case 'kg':
              threshold = 0.05; // 0.05kg threshold for kilograms
              break;
            case 'oz':
              threshold = 0.125; // 1/8 oz threshold for ounces
              break;
            case 'lb':
            default:
              threshold = 0.05; // 0.05lb threshold for pounds
              break;
          }
          
          if (Math.abs(normalizedAmount - normalizedCurrentAmount) > threshold) {
            // Generate smart reason based on recommendations
            let reason = `Increase proportionally to achieve ${targetBaseMaltPercentage}% base malt for better fermentability`;
            if (topRecommendation && baseMalt.name.toLowerCase().includes(topRecommendation.maltName.toLowerCase())) {
              reason = `${topRecommendation.reason} - increase to ${targetBaseMaltPercentage}% base malt`;
            }
            
            changes.push({
              ingredientId: baseMalt.id!,
              ingredientName: baseMalt.name,
              field: 'amount',
              currentValue: normalizedCurrentAmount,
              suggestedValue: normalizedAmount,
              reason
            });
          }
        });

        // Calculate cascading effects for base malt changes
        let cascadingEffects: CascadingEffects | undefined;
        try {
          cascadingEffects = await cascadingEffectsService.calculateCascadingEffects(
            recipe,
            ingredients,
            changes,
            currentMetrics
          );
        } catch (error) {
          console.warn('Failed to calculate cascading effects:', error);
        }

        // Generate enhanced description with style context
        let description = `Current base malt: ${baseMaltPercentage.toFixed(1)}%. Consider increasing to 60%+ for better fermentability`;
        if (selectedStyleGuide && topRecommendation) {
          description = `Current base malt: ${baseMaltPercentage.toFixed(1)}%. Increase ${topRecommendation.maltName} for ${selectedStyleGuide.name} style characteristics`;
        } else if (recipe.style && topRecommendation) {
          description = `Current base malt: ${baseMaltPercentage.toFixed(1)}%. Increase ${topRecommendation.maltName} for ${recipe.style} style characteristics`;
        }

        // Determine priority based on how low the base malt percentage is
        const priority = baseMaltPercentage < 40 ? 2 : baseMaltPercentage < 50 ? 1.5 : 1;
        const impactType = baseMaltPercentage < 40 ? 'critical' : baseMaltPercentage < 50 ? 'important' : 'nice-to-have';

        suggestions.push({
          id: 'base-malt-percentage',
          type: 'base_malt',
          title: 'Smart Base Malt Selection',
          description,
          confidence: 'medium',
          changes,
          cascadingEffects,
          priority,
          impactType,
          styleImpact: selectedStyleGuide ? `Improves fermentability and ${selectedStyleGuide.name} style character` : 'Improves fermentability'
        });
      }
    }

    return suggestions;
  };

  // Generate style compliance suggestions using BeerStyleGuide
  const generateStyleComplianceSuggestionsFromStyleGuide = async (
    styleGuide: BeerStyleGuide,
    ingredients: RecipeIngredient[],
    metrics: RecipeMetrics
  ): Promise<Suggestion[]> => {
    const suggestions: Suggestion[] = [];
    
    // Use enhanced style compliance analysis
    const styleCharacteristics = enhancedStyleComplianceService.analyzeStyleCharacteristics(styleGuide);
    const styleCompliance = enhancedStyleComplianceService.analyzeStyleCompliance(metrics, styleGuide);
    const optimizationTargets = enhancedStyleComplianceService.generateOptimizationTargets(styleCompliance, styleGuide);
    
    // console.log('Style characteristics:', styleCharacteristics);
    // console.log('Style compliance:', styleCompliance);
    // console.log('Optimization targets:', optimizationTargets);
    // console.log('Current metrics:', metrics);
    // console.log('Style guide SRM range:', styleGuide.color);
    
    // Generate suggestions based on optimization targets
    for (const target of optimizationTargets) {
      const changes = await generateChangesForOptimizationTarget(target, ingredients, metrics, styleCharacteristics);
      
      if (changes.length > 0) {
        // Calculate cascading effects for this specific suggestion
        let cascadingEffects: CascadingEffects | undefined;
        try {
          cascadingEffects = await cascadingEffectsService.calculateCascadingEffects(
            recipe,
            ingredients,
            changes,
            metrics
          );
        } catch (error) {
          console.warn('Failed to calculate cascading effects:', error);
        }
        
        suggestions.push({
          id: `style-compliance-${target.metric}`,
          type: 'style_compliance',
          title: `Optimize ${target.metric.toUpperCase()} for ${styleGuide.name}`,
          description: target.reasoning,
          confidence: target.impactType === 'critical' ? 'high' : target.impactType === 'important' ? 'medium' : 'low',
          changes,
          cascadingEffects,
          priority: target.priority,
          styleImpact: `Improves ${target.metric.toUpperCase()} compliance from ${target.currentValue.toFixed(target.metric === 'og' || target.metric === 'fg' ? 3 : 1)} to ${target.targetValue.toFixed(target.metric === 'og' || target.metric === 'fg' ? 3 : 1)}`,
          impactType: target.impactType
        });
      }
    }
    
    return suggestions;
  };

  // Helper function to generate changes for optimization targets
  const generateChangesForOptimizationTarget = async (
    target: StyleOptimizationTarget,
    ingredients: RecipeIngredient[],
    _metrics: RecipeMetrics,
    characteristics: StyleCharacteristics
  ): Promise<IngredientChange[]> => {
    switch (target.metric) {
      case 'ibu':
        return generateIBUChanges(target, ingredients, characteristics);
      case 'srm':
        return generateSRMChanges(target, ingredients, characteristics);
      case 'og':
        return generateOGChanges(target, ingredients, characteristics);
      case 'fg':
        return generateFGChanges(target, ingredients, characteristics);
      case 'abv':
        return generateABVChanges(target, ingredients, characteristics);
      default:
        return [];
    }
  };

  // Generate IBU adjustment changes
  const generateIBUChanges = async (
    target: StyleOptimizationTarget,
    ingredients: RecipeIngredient[],
    characteristics: StyleCharacteristics
  ): Promise<IngredientChange[]> => {
    const changes: IngredientChange[] = [];
    const currentIBU = target.currentValue;
    const targetIBU = target.targetValue;
    
    if (currentIBU > targetIBU) {
      // Reduce IBU - adjust hop times or amounts
      const bitteringHops = ingredients.filter(
        ingredient => ingredient.type === 'hop' && ingredient.use === 'boil' && (ingredient.time || 0) >= 45
      );
      
      // Prefer time reduction for hop-forward styles to maintain hop character
      if (characteristics.isHopForward && bitteringHops.length > 0) {
        bitteringHops.forEach(hop => {
          if (hop.time && hop.time > 30) {
            changes.push({
              ingredientId: hop.id!,
              ingredientName: hop.name,
              field: 'time',
              currentValue: hop.time,
              suggestedValue: Math.max(hop.time - 15, 30),
              reason: `Reduce boil time to lower IBU while maintaining hop character for hop-forward style`
            });
          }
        });
      } else {
        // For non-hop-forward styles, reduce hop amounts
        bitteringHops.forEach(hop => {
          const reductionFactor = targetIBU / currentIBU;
          const newAmount = hop.amount * reductionFactor;
          const normalizedNew = normalizeAmountForUnit(newAmount, hop.unit);
          
          if (Math.abs(hop.amount - normalizedNew) > 0.01) {
            changes.push({
              ingredientId: hop.id!,
              ingredientName: hop.name,
              field: 'amount',
              currentValue: hop.amount,
              suggestedValue: normalizedNew,
              reason: `Reduce amount to achieve target IBU for balanced style`
            });
          }
        });
      }
    } else if (currentIBU < targetIBU) {
      // Increase IBU - add or increase hop amounts
      const bitteringHops = ingredients.filter(
        ingredient => ingredient.type === 'hop' && ingredient.use === 'boil' && (ingredient.time || 0) >= 45
      );
      
      if (bitteringHops.length > 0) {
        const increaseFactor = targetIBU / currentIBU;
        bitteringHops.forEach(hop => {
          const newAmount = hop.amount * increaseFactor;
          const normalizedNew = normalizeAmountForUnit(newAmount, hop.unit);
          
          if (Math.abs(hop.amount - normalizedNew) > 0.01) {
            changes.push({
              ingredientId: hop.id!,
              ingredientName: hop.name,
              field: 'amount',
              currentValue: hop.amount,
              suggestedValue: normalizedNew,
              reason: `Increase amount to achieve target IBU for proper bitterness balance`
            });
          }
        });
      }
    }
    
    return changes;
  };

  // Generate SRM adjustment changes
  const generateSRMChanges = async (
    target: StyleOptimizationTarget,
    ingredients: RecipeIngredient[],
    _characteristics: StyleCharacteristics
  ): Promise<IngredientChange[]> => {
    const changes: IngredientChange[] = [];
    const currentSRM = target.currentValue;
    const targetSRM = target.targetValue;
    
    if (currentSRM > targetSRM) {
      // Reduce SRM - reduce roasted malts
      const roastedMalts = ingredients.filter(
        ingredient => ingredient.type === 'grain' && 
        ingredient.grain_type === 'roasted' && 
        ingredient.amount > 0.1
      );
      
      if (roastedMalts.length > 0) {
        const srmReduction = currentSRM - targetSRM;
        
        roastedMalts.forEach(malt => {
          // Simple reduction approach - reduce proportionally
          const reductionFactor = Math.min(srmReduction / currentSRM, 0.5); // Max 50% reduction
          const newAmount = malt.amount * (1 - reductionFactor);
          const normalizedNew = normalizeAmountForUnit(newAmount, malt.unit);
          
          if (Math.abs(malt.amount - normalizedNew) > 0.01) {
            changes.push({
              ingredientId: malt.id!,
              ingredientName: malt.name,
              field: 'amount',
              currentValue: malt.amount,
              suggestedValue: normalizedNew,
              reason: `Reduce to achieve target SRM of ${targetSRM.toFixed(1)} for proper color balance`
            });
          }
        });
      }
    } else if (currentSRM < targetSRM) {
      // Increase SRM - suggest adding roasted malts or increasing existing ones
      const roastedMalts = ingredients.filter(
        ingredient => ingredient.type === 'grain' && 
        ingredient.grain_type === 'roasted'
      );
      
      if (roastedMalts.length > 0) {
        const srmIncrease = targetSRM - currentSRM;
        
        roastedMalts.forEach(malt => {
          const increaseFactor = Math.min(srmIncrease / currentSRM, 0.3); // Max 30% increase
          const newAmount = malt.amount * (1 + increaseFactor);
          const normalizedNew = normalizeAmountForUnit(newAmount, malt.unit);
          
          if (Math.abs(malt.amount - normalizedNew) > 0.01) {
            changes.push({
              ingredientId: malt.id!,
              ingredientName: malt.name,
              field: 'amount',
              currentValue: malt.amount,
              suggestedValue: normalizedNew,
              reason: `Increase to achieve target SRM of ${targetSRM.toFixed(1)} for proper color balance`
            });
          }
        });
      }
    }
    
    return changes;
  };

  // Generate OG adjustment changes
  const generateOGChanges = async (
    target: StyleOptimizationTarget,
    ingredients: RecipeIngredient[],
    _characteristics: StyleCharacteristics
  ): Promise<IngredientChange[]> => {
    const changes: IngredientChange[] = [];
    const currentOG = target.currentValue;
    const targetOG = target.targetValue;
    
    // Validate input values
    if (!currentOG || currentOG <= 1.0 || !targetOG || targetOG <= 1.0) {
      return changes; // Cannot calculate with invalid OG values
    }
    
    const grains = ingredients.filter(ingredient => ingredient.type === 'grain');
    const baseMalts = grains.filter(grain => grain.grain_type === 'base_malt');
    
    if (baseMalts.length > 0) {
      const adjustmentFactor = targetOG / currentOG;
      
      // Validate adjustment factor
      if (!isFinite(adjustmentFactor) || adjustmentFactor <= 0) {
        return changes; // Cannot calculate with invalid adjustment factor
      }
      
      baseMalts.forEach(malt => {
        const newAmount = malt.amount * adjustmentFactor;
        
        // Validate new amount
        if (!isFinite(newAmount) || newAmount <= 0) {
          return; // Skip this malt if calculation is invalid
        }
        
        const normalizedNew = normalizeAmountForUnit(newAmount, malt.unit);
        
        if (Math.abs(malt.amount - normalizedNew) > 0.01) {
          changes.push({
            ingredientId: malt.id!,
            ingredientName: malt.name,
            field: 'amount',
            currentValue: malt.amount,
            suggestedValue: normalizedNew,
            reason: `Adjust base malt to achieve target OG for proper fermentation`
          });
        }
      });
    }
    
    return changes;
  };

  // Generate FG adjustment changes
  const generateFGChanges = async (
    _target: StyleOptimizationTarget,
    _ingredients: RecipeIngredient[],
    _characteristics: StyleCharacteristics
  ): Promise<IngredientChange[]> => {
    // FG is primarily controlled by yeast and mash temperature
    // For now, suggest yeast changes or malt adjustments
    return [];
  };

  // Generate ABV adjustment changes
  const generateABVChanges = async (
    target: StyleOptimizationTarget,
    ingredients: RecipeIngredient[],
    characteristics: StyleCharacteristics
  ): Promise<IngredientChange[]> => {
    // ABV is controlled by OG and FG, so adjust base malts
    return generateOGChanges(target, ingredients, characteristics);
  };

  // Generate style compliance suggestions (legacy method)
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
            }],
            priority: 0.8, // Lower priority
            impactType: 'nice-to-have',
            styleImpact: 'Improves final gravity estimation accuracy'
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
      // Prepare bulk updates
      const updates = suggestion.changes.map(change => {
        // Find the existing ingredient to get required fields for validation
        const existingIngredient = ingredients.find(ing => ing.id === change.ingredientId);
        if (!existingIngredient) {
          throw new Error(`Ingredient ${change.ingredientName} not found`);
        }
        
        // Include all necessary fields for validation
        const updateData: Partial<RecipeIngredient> = {
          [change.field]: change.suggestedValue,
          // Include required validation fields
          ingredient_id: existingIngredient.ingredient_id,
          unit: existingIngredient.unit,
          // Include hop-specific fields if it's a hop
          ...(existingIngredient.type === 'hop' && {
            use: existingIngredient.use,
            time: existingIngredient.time
          })
        };
        
        return {
          ingredientId: change.ingredientId,
          updatedData: updateData
        };
      });

      // Apply all changes as a single bulk update
      await onBulkIngredientUpdate(updates);

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

  // Handle analyze button click
  const handleAnalyzeRecipe = (): void => {
    if (!ingredients.length || !metrics) return;
    generateCohesiveSuggestions();
  };

  // Reset suggestions when ingredients change significantly
  useEffect(() => {
    if (hasAnalyzed) {
      setHasAnalyzed(false);
      setSuggestions([]);
    }
  }, [ingredients.length, recipe.style]);

  // Always render the component to show the analyze button
  const canAnalyze = ingredients.length > 0 && metrics && !analyzing && !disabled;
  
  if (!suggestions.length && !hasAnalyzed && !analyzing) {
    return (
      <div className="ai-suggestions-card">
        <div className="ai-suggestions-header">
          <h3 className="ai-suggestions-title">
            🤖 AI Recipe Analysis
          </h3>
        </div>
        <div className="ai-suggestions-content">
          <div className="analyze-recipe-section">
            <p className="analyze-description">
              Get comprehensive suggestions to improve your recipe including base malt optimization, 
              style compliance, and ingredient normalization.
            </p>
            <button 
              className="btn btn-primary analyze-button"
              onClick={handleAnalyzeRecipe}
              disabled={!canAnalyze}
            >
              {analyzing ? (
                <>
                  <span className="button-spinner"></span>
                  Analyzing Recipe...
                </>
              ) : (
                'Analyze Recipe & Suggest Improvements'
              )}
            </button>
            {!canAnalyze && ingredients.length === 0 && (
              <p className="help-text">Add ingredients to your recipe to get analysis.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-suggestions-card">
      <div className="ai-suggestions-header">
        <h3 className="ai-suggestions-title">
          🤖 AI Recipe Analysis
          {analyzing && <span className="loading-spinner"></span>}
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
          {!hasAnalyzed && (
            <div className="analyze-recipe-section">
              <button 
                className="btn btn-primary analyze-button"
                onClick={handleAnalyzeRecipe}
                disabled={!canAnalyze}
              >
                {analyzing ? (
                  <>
                    <span className="button-spinner"></span>
                    Analyzing Recipe...
                  </>
                ) : (
                  'Analyze Recipe & Suggest Improvements'
                )}
              </button>
            </div>
          )}
          {suggestions.map(suggestion => (
            <div key={suggestion.id} className={`ai-suggestion-item ${suggestion.impactType || 'nice-to-have'}`}>
              <div className="ai-suggestion-header">
                <h4 className="ai-suggestion-title">
                  {suggestion.title}
                  {suggestion.impactType === 'critical' && <span className="priority-indicator critical">🔥</span>}
                  {suggestion.impactType === 'important' && <span className="priority-indicator important">⚠️</span>}
                </h4>
                <div className="ai-suggestion-meta">
                  <span className={`ai-suggestion-confidence ${suggestion.confidence}`}>
                    {suggestion.confidence}
                  </span>
                  {suggestion.priority && (
                    <span className="ai-suggestion-priority">
                      Priority: {suggestion.priority.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
              
              <p className="ai-suggestion-description">{suggestion.description}</p>
              
              {suggestion.styleImpact && (
                <div className="ai-suggestion-style-impact">
                  <span className="style-impact-label">Style Impact:</span>
                  <span className="style-impact-text">{suggestion.styleImpact}</span>
                </div>
              )}
              
              {suggestion.changes.length > 0 && (
                <div className="ai-suggestion-changes">
                  {suggestion.changes.map((change, index) => {
                    const ingredient = ingredients.find(ing => ing.id === change.ingredientId);
                    const currentValueFormatted = ingredient && change.field === 'amount' 
                      ? formatIngredientAmount(change.currentValue, ingredient.unit, ingredient.type, unitSystem)
                      : change.currentValue;
                    const suggestedValueFormatted = ingredient && change.field === 'amount'
                      ? formatIngredientAmount(change.suggestedValue, ingredient.unit, ingredient.type, unitSystem)
                      : change.suggestedValue;
                    
                    return (
                      <div key={index} className="ai-suggestion-change">
                        <span className="change-ingredient">{change.ingredientName}</span>
                        <span className="change-detail">
                          {change.field}: {currentValueFormatted} → {suggestedValueFormatted}
                        </span>
                        <span className="change-reason">{change.reason}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {suggestion.cascadingEffects && (
                <div className="ai-suggestion-cascading-effects">
                  <h5 className="cascading-effects-title">Predicted Effects:</h5>
                  <div className="cascading-effects-grid">
                    {Object.entries(suggestion.cascadingEffects.impacts).map(([metric, change]) => (
                      <div key={metric} className="cascading-effect-item">
                        <span className="metric-name">{metric.toUpperCase()}</span>
                        <span className="metric-change">
                          {cascadingEffectsService.formatMetricChange(change)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="ai-suggestion-actions">
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={() => applySuggestion(suggestion)}
                  disabled={disabled || analyzing}
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