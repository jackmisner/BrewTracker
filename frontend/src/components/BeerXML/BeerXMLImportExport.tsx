import React, { useReducer, useRef } from "react";
import { Services } from "@/services";
import IngredientMatchingReview from "@/components/BeerXML/IngredientMatchingReview";
import UnitConversionChoice from "@/components/BeerXML/UnitConversionChoice";
import { Recipe, Ingredient, UnitSystem } from "@/types";
import {
  BeerXMLImportData,
  BeerXMLMetadata,
  BeerXMLExportResult,
} from "@/types/beerxml";
import { beerXMLReducer, createInitialBeerXMLState } from "@/reducers";
import { useUnits } from "@/contexts/UnitContext";
import type { BeerXMLRecipe } from "@/services/BeerXML/BeerXMLService";
import "@/styles/BeerXMLImportExport.css";

interface BeerXMLImportExportProps {
  recipe?: Recipe;
  ingredients?: Ingredient[];
  onImport?: (importData: BeerXMLImportData) => Promise<void>;
  onExport?: (exportResult: BeerXMLExportResult) => void;
  mode?: "import" | "export" | "both";
}

const BeerXMLImportExport: React.FC<BeerXMLImportExportProps> = ({
  recipe,
  ingredients,
  onImport,
  onExport,
  mode = "both",
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { unitSystem } = useUnits(); // Get user's unit preference

  // Initialize reducer
  const [state, dispatch] = useReducer(
    beerXMLReducer,
    createInitialBeerXMLState()
  );

  // Destructure state for cleaner access
  const { import: importState, export: exportState } = state;

  /**
   * Handle file selection for import
   */
  const handleFileSelect = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file using service
    const validation = Services.BeerXML.service.validateFile(file);
    if (!validation.valid) {
      dispatch({ type: "IMPORT_ERROR", payload: validation.errors.join("; ") });
      return;
    }

    dispatch({ type: "SET_UPLOADED_FILE", payload: file });
  };

  /**
   * Process uploaded BeerXML file
   */
  const processBeerXMLFile = async (): Promise<void> => {
    if (!importState.uploadedFile) return;

    dispatch({ type: "IMPORT_START" });

    try {
      // Read file content
      const fileContent = await Services.BeerXML.service.readFileContent(
        importState.uploadedFile
      );

      // Parse BeerXML using backend
      const parsedRecipes: any[] =
        await Services.BeerXML.service.parseBeerXML(fileContent);

      dispatch({
        type: "IMPORT_SUCCESS",
        payload: { recipes: parsedRecipes, warnings: [] },
      });

      const firstRecipe = parsedRecipes[0] || null;
      dispatch({
        type: "SELECT_RECIPE",
        payload: firstRecipe,
      });

      // Check for unit system mismatch
      if (firstRecipe) {
        const recipeUnitSystem =
          Services.BeerXML.service.detectRecipeUnitSystem(firstRecipe);

        // Show conversion choice if there's a mismatch (and not mixed)
        if (recipeUnitSystem !== unitSystem && recipeUnitSystem !== "mixed") {
          dispatch({
            type: "SHOW_UNIT_CONVERSION_CHOICE",
            payload: {
              recipeUnitSystem: recipeUnitSystem as UnitSystem,
              userUnitSystem: unitSystem as UnitSystem,
            },
          });
        }
      }
    } catch (error: any) {
      console.error("Error processing BeerXML file:", error);
      dispatch({ type: "IMPORT_ERROR", payload: error.message });
    }
  };

  /**
   * Handle importing recipe as-is (without unit conversion)
   */
  const handleImportAsIs = async (): Promise<void> => {
    dispatch({ type: "HIDE_UNIT_CONVERSION_CHOICE" });
    await startIngredientMatching();
  };

  /**
   * Handle converting recipe units before import
   */
  const handleConvertAndImport = async (): Promise<void> => {
    if (!importState.selectedRecipe || !importState.userUnitSystem) return;

    dispatch({ type: "IMPORT_START" });

    try {
      // Convert recipe units (both are guaranteed non-null by guard at line 124)
      const convertedRecipe = await Services.BeerXML.service.convertRecipeUnits(
        importState.selectedRecipe as BeerXMLRecipe,
        importState.userUnitSystem!
      );

      // Hide dialog
      dispatch({ type: "HIDE_UNIT_CONVERSION_CHOICE" });

      // Find index of selected recipe
      const selectedIndex = importState.parsedRecipes.findIndex(
        r => r === importState.selectedRecipe
      );

      // Update parsed recipes with converted version
      const updatedRecipes = importState.parsedRecipes.map((r, idx) =>
        idx === selectedIndex ? convertedRecipe : r
      );

      // Proceed to ingredient matching with converted recipe
      await startIngredientMatching(convertedRecipe, updatedRecipes);
    } catch (error: any) {
      console.error("Error converting recipe units:", error);
      dispatch({ type: "IMPORT_ERROR", payload: error.message });
      dispatch({ type: "HIDE_UNIT_CONVERSION_CHOICE" });
    }
  };

  /**
   * Handle canceling unit conversion choice
   */
  const handleCancelConversion = (): void => {
    dispatch({ type: "HIDE_UNIT_CONVERSION_CHOICE" });
  };

  /**
   * Handle recipe selection change
   * Checks for unit mismatch when switching between recipes
   */
  const handleRecipeSelection = (recipe: BeerXMLRecipe): void => {
    dispatch({
      type: "SELECT_RECIPE",
      payload: recipe,
    });

    // Check for unit system mismatch with newly selected recipe
    if (recipe) {
      const recipeUnitSystem =
        Services.BeerXML.service.detectRecipeUnitSystem(recipe);

      // Show conversion choice if there's a mismatch (and not mixed)
      if (recipeUnitSystem !== unitSystem && recipeUnitSystem !== "mixed") {
        dispatch({
          type: "SHOW_UNIT_CONVERSION_CHOICE",
          payload: {
            recipeUnitSystem: recipeUnitSystem as UnitSystem,
            userUnitSystem: unitSystem as UnitSystem,
          },
        });
      }
    }
  };

  /**
   * Start ingredient matching process
   * @param recipeOverride - Optional recipe to use instead of importState.selectedRecipe
   * @param recipesOverride - Optional recipes list to use instead of importState.parsedRecipes
   */
  const startIngredientMatching = async (
    recipeOverride?: BeerXMLRecipe,
    recipesOverride?: BeerXMLRecipe[]
  ): Promise<void> => {
    const recipe = recipeOverride ?? importState.selectedRecipe;
    const recipes = recipesOverride ?? importState.parsedRecipes;

    if (!recipe) return;

    dispatch({ type: "IMPORT_START" });

    try {
      // Update selected recipe if override provided
      if (recipeOverride) {
        dispatch({
          type: "SELECT_RECIPE",
          payload: recipeOverride,
        });
      }

      const matchingResults = await Services.BeerXML.service.matchIngredients(
        recipe.ingredients || []
      );

      dispatch({ type: "SET_MATCHING_RESULTS", payload: matchingResults });
      dispatch({ type: "SHOW_MATCHING_REVIEW", payload: true });
      dispatch({
        type: "IMPORT_SUCCESS",
        payload: { recipes, warnings: [] },
      });
    } catch (error: any) {
      console.error("Error matching ingredients:", error);
      dispatch({ type: "IMPORT_ERROR", payload: error.message });
    }
  };

  /**
   * Complete the import process - UPDATED to handle new structure
   */
  const completeImport = async (
    importResult:
      | BeerXMLImportData
      | { ingredients: Ingredient[]; createdIngredients: Ingredient[] }
  ): Promise<void> => {
    if (!importState.selectedRecipe || !onImport) return;

    try {
      // Handle both old and new structure for backwards compatibility
      const finalizedIngredients =
        "ingredients" in importResult
          ? importResult.ingredients
          : (importResult as any);
      const createdIngredients =
        "createdIngredients" in importResult
          ? importResult.createdIngredients
          : [];

      await onImport({
        recipe: importState.selectedRecipe as Recipe,
        ingredients: finalizedIngredients,
        metadata:
          (importState.selectedRecipe as any)?.metadata ||
          ({} as BeerXMLMetadata),
        createdIngredients: createdIngredients, // Pass created ingredients for cache update
      });

      // Reset import state
      dispatch({ type: "RESET_IMPORT_STATE" });

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error: any) {
      console.error("Error completing import:", error);
      dispatch({ type: "IMPORT_ERROR", payload: error.message });
      dispatch({ type: "SHOW_MATCHING_REVIEW", payload: false });
    }
  };

  /**
   * Export current recipe to BeerXML
   */
  const exportToBeerXML = async (): Promise<void> => {
    if (!recipe || !ingredients || !onExport) return;

    // Check if recipe is saved
    const id = recipe.recipe_id ?? recipe.id;
    if (id == null) {
      dispatch({
        type: "EXPORT_ERROR",
        payload:
          "Cannot export unsaved recipe. Please save your recipe first to enable BeerXML export.",
      });
      return;
    }

    dispatch({ type: "EXPORT_START" });

    try {
      const result = await Services.BeerXML.service.exportRecipe(id);

      // Download file
      Services.BeerXML.service.downloadBeerXML(
        result.xmlContent,
        result.filename
      );

      if (onExport) {
        onExport({ success: true, filename: result.filename });
      }

      dispatch({
        type: "EXPORT_SUCCESS",
        payload: { success: true, filename: result.filename },
      });
    } catch (error: any) {
      console.error("Error exporting to BeerXML:", error);
      dispatch({ type: "EXPORT_ERROR", payload: error.message });
    }
  };

  /**
   * Reset import state
   */
  const resetImport = (): void => {
    dispatch({ type: "RESET_IMPORT_STATE" });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Show unit conversion choice dialog
  if (importState.showUnitConversionChoice) {
    return (
      <UnitConversionChoice
        recipeUnitSystem={importState.recipeUnitSystem}
        userUnitSystem={importState.userUnitSystem}
        recipeName={importState.selectedRecipe?.name || "Recipe"}
        onImportAsIs={handleImportAsIs}
        onConvertAndImport={handleConvertAndImport}
        onCancel={handleCancelConversion}
        isConverting={importState.isImporting}
      />
    );
  }

  // Show ingredient matching review
  if (importState.showMatchingReview) {
    return (
      <IngredientMatchingReview
        matchingResults={importState.matchingResults}
        onComplete={completeImport}
        onCancel={() =>
          dispatch({ type: "SHOW_MATCHING_REVIEW", payload: false })
        }
      />
    );
  }

  return (
    <div className="beerxml-import-export">
      {(mode === "import" || mode === "both") && (
        <div className="beerxml-import-section">
          <h3 className="section-title">Import from BeerXML</h3>

          {/* File Upload */}
          <div className="file-upload-area">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml"
              onChange={handleFileSelect}
              className="file-input"
              data-testid="beerxml-file-input"
            />

            <div
              className={`upload-dropzone ${
                importState.uploadedFile ? "has-file" : ""
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              {importState.uploadedFile ? (
                <div className="file-info">
                  <div className="file-icon">📄</div>
                  <div className="file-details">
                    <div className="file-name">
                      {importState.uploadedFile.name}
                    </div>
                    <div className="file-size">
                      {(importState.uploadedFile.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                </div>
              ) : (
                <div className="upload-prompt">
                  <div className="upload-icon">📥</div>
                  <div className="upload-text">
                    Click to select BeerXML file or drag and drop
                  </div>
                  <div className="upload-hint">
                    Supports .xml files in BeerXML format
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Parse File Button */}
          {importState.uploadedFile && !importState.parsedRecipes.length && (
            <div className="import-actions">
              <button
                onClick={processBeerXMLFile}
                disabled={importState.isImporting}
                className="btn btn-primary"
              >
                {importState.isImporting ? (
                  <>
                    <span className="button-spinner"></span>
                    Parsing...
                  </>
                ) : (
                  "Parse BeerXML File"
                )}
              </button>

              <button onClick={resetImport} className="btn btn-secondary">
                Clear
              </button>
            </div>
          )}

          {/* Recipe Selection */}
          {importState.parsedRecipes.length > 0 && (
            <div className="recipe-selection">
              <h4>Found {importState.parsedRecipes.length} recipe(s)</h4>

              {importState.parsedRecipes.length > 1 && (
                <div className="recipe-selector">
                  <label>Select recipe to import:</label>
                  <select
                    value={importState.parsedRecipes.indexOf(
                      importState.selectedRecipe || importState.parsedRecipes[0]
                    )}
                    onChange={e =>
                      handleRecipeSelection(
                        importState.parsedRecipes[parseInt(e.target.value)]
                      )
                    }
                    className="form-select"
                  >
                    {importState.parsedRecipes.map((recipe, index) => (
                      <option key={index} value={index}>
                        {recipe?.name || "Unknown Recipe"} (
                        {(recipe as any)?.ingredients?.length || 0} ingredients)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Recipe Preview */}
              {importState.selectedRecipe && (
                <div className="recipe-preview">
                  <h5>Recipe Preview</h5>
                  <div className="recipe-details">
                    <div className="detail-row">
                      <span className="label">Name:</span>
                      <span className="value">
                        {importState.selectedRecipe?.name || "N/A"}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Style:</span>
                      <span className="value">
                        {(importState.selectedRecipe as any)?.style ||
                          "Not specified"}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Batch Size:</span>
                      <span className="value">
                        {(
                          importState.selectedRecipe as any
                        )?.batch_size?.toFixed(0) || "N/A"}{" "}
                        {(importState.selectedRecipe as any)
                          ?.batch_size_unit === "l"
                          ? "L"
                          : (importState.selectedRecipe as any)
                              ?.batch_size_unit || "gal"}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Ingredients:</span>
                      <span className="value">
                        {(importState.selectedRecipe as any)?.ingredients
                          ?.length || 0}
                      </span>
                    </div>
                  </div>

                  {/* Ingredient Summary */}
                  <div className="ingredient-summary">
                    <h6>Ingredients</h6>
                    <div className="ingredient-types">
                      {["grain", "hop", "yeast", "other"].map(type => {
                        const count =
                          (
                            importState.selectedRecipe as any
                          )?.ingredients?.filter(
                            (ing: any) => ing.type === type
                          ).length || 0;
                        if (count === 0) return null;

                        return (
                          <span
                            key={type}
                            className={`ingredient-type-badge ${type}`}
                          >
                            {count} {type}
                            {count !== 1 ? "s" : ""}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Import Button */}
                  <div className="import-recipe-actions">
                    <button
                      onClick={() => startIngredientMatching()}
                      disabled={importState.isImporting}
                      className="btn btn-primary"
                    >
                      {importState.isImporting ? (
                        <>
                          <span className="button-spinner"></span>
                          Matching Ingredients...
                        </>
                      ) : (
                        "Import Recipe"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Import Errors */}
          {importState.error && (
            <div className="error-message">
              <div className="error-icon">⚠️</div>
              <div className="error-text">{importState.error}</div>
            </div>
          )}
        </div>
      )}

      {(mode === "export" || mode === "both") && (
        <div className="beerxml-export-section">
          <h3 className="section-title">Export to BeerXML</h3>

          <div className="export-info">
            <p>
              Export your recipe in BeerXML format to share with other brewing
              software or backup your recipes.
            </p>

            {recipe && (
              <div className="current-recipe-info">
                <div className="recipe-name">
                  <strong>{recipe.name}</strong>
                </div>
                <div className="recipe-stats">
                  {ingredients?.length} ingredients • {recipe.batch_size}{" "}
                  {recipe.batch_size_unit || "gal"}
                </div>
              </div>
            )}
          </div>

          <div className="export-actions">
            <button
              onClick={exportToBeerXML}
              disabled={
                exportState.isExporting ||
                !recipe ||
                !ingredients?.length ||
                (recipe.recipe_id ?? recipe.id) == null
              }
              className="btn btn-primary"
            >
              {exportState.isExporting ? (
                <>
                  <span className="button-spinner"></span>
                  Exporting...
                </>
              ) : (
                <>📄 Export as BeerXML</>
              )}
            </button>

            {/* Show message for unsaved recipes */}
            {(recipe?.recipe_id ?? recipe?.id) == null && recipe && (
              <div className="export-info-message">
                <small>
                  💡 Save your recipe first to enable BeerXML export
                </small>
              </div>
            )}
          </div>

          {/* Export Errors */}
          {exportState.error && (
            <div className="error-message">
              <div className="error-icon">⚠️</div>
              <div className="error-text">{exportState.error}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BeerXMLImportExport;
