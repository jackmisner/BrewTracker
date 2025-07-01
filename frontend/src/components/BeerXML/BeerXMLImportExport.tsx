import React, { useState, useRef } from "react";
import beerXMLService from "../../services/BeerXML/BeerXMLService";
import IngredientMatchingReview from "./IngredientMatchingReview";
import { Recipe } from "../../types";
import "../../styles/BeerXMLImportExport.css";

interface BeerXMLImportExportProps {
  recipe?: Recipe;
  ingredients?: any[]; // TODO: Define proper ingredient array type
  onImport?: (importData: {
    recipe: Recipe;
    ingredients: any[];
    metadata: any;
    createdIngredients: any[];
  }) => Promise<void>;
  onExport?: (exportResult: { success: boolean; filename: string }) => void;
  mode?: "import" | "export" | "both";
}

interface ImportState {
  isImporting: boolean;
  uploadedFile: File | null;
  parsedRecipes: any[]; // TODO: Define proper parsed recipe type
  selectedRecipe: any | null; // TODO: Define proper selected recipe type
  matchingResults: any[];
  showMatchingReview: boolean;
  error: string | null;
}

interface ExportState {
  isExporting: boolean;
  error: string | null;
}

const BeerXMLImportExport: React.FC<BeerXMLImportExportProps> = ({
  recipe,
  ingredients,
  onImport,
  onExport,
  mode = "both",
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import state
  const [importState, setImportState] = useState<ImportState>({
    isImporting: false,
    uploadedFile: null,
    parsedRecipes: [],
    selectedRecipe: null,
    matchingResults: [],
    showMatchingReview: false,
    error: null,
  });

  // Export state
  const [exportState, setExportState] = useState<ExportState>({
    isExporting: false,
    error: null,
  });

  /**
   * Handle file selection for import
   */
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file using service
    const validation = beerXMLService.validateFile(file);
    if (!validation.valid) {
      setImportState((prev) => ({
        ...prev,
        error: validation.errors.join("; "),
      }));
      return;
    }

    setImportState((prev) => ({
      ...prev,
      uploadedFile: file,
      error: null,
    }));
  };

  /**
   * Process uploaded BeerXML file
   */
  const processBeerXMLFile = async (): Promise<void> => {
    if (!importState.uploadedFile) return;

    setImportState((prev) => ({
      ...prev,
      isImporting: true,
      error: null,
    }));

    try {
      // Read file content
      const fileContent = await beerXMLService.readFileContent(
        importState.uploadedFile
      );

      // Parse BeerXML using backend
      const parsedRecipes = await beerXMLService.parseBeerXML(fileContent);
      // console.log(parsedRecipes[0])
      setImportState((prev) => ({
        ...prev,
        parsedRecipes,
        selectedRecipe: parsedRecipes[0] || null,
        isImporting: false,
      }));
    } catch (error: any) {
      console.error("Error processing BeerXML file:", error);
      setImportState((prev) => ({
        ...prev,
        error: error.message,
        isImporting: false,
      }));
    }
  };

  /**
   * Start ingredient matching process
   */
  const startIngredientMatching = async (): Promise<void> => {
    if (!importState.selectedRecipe) return;

    setImportState((prev) => ({
      ...prev,
      isImporting: true,
      error: null,
    }));

    try {
      const matchingResults = await beerXMLService.matchIngredients(
        importState.selectedRecipe.ingredients
      );

      setImportState((prev) => ({
        ...prev,
        matchingResults,
        showMatchingReview: true,
        isImporting: false,
      }));
    } catch (error: any) {
      console.error("Error matching ingredients:", error);
      setImportState((prev) => ({
        ...prev,
        error: error.message,
        isImporting: false,
      }));
    }
  };

  /**
   * Complete the import process - UPDATED to handle new structure
   */
  const completeImport = async (importResult: any): Promise<void> => {
    if (!importState.selectedRecipe || !onImport) return;

    try {
      // Handle both old and new structure for backwards compatibility
      const finalizedIngredients = importResult.ingredients || importResult;
      const createdIngredients = importResult.createdIngredients || [];

      await onImport({
        recipe: importState.selectedRecipe,
        ingredients: finalizedIngredients,
        metadata: importState.selectedRecipe.metadata,
        createdIngredients: createdIngredients, // Pass created ingredients for cache update
      });

      // Reset import state
      setImportState({
        isImporting: false,
        uploadedFile: null,
        parsedRecipes: [],
        selectedRecipe: null,
        matchingResults: [],
        showMatchingReview: false,
        error: null,
      });

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error: any) {
      console.error("Error completing import:", error);
      setImportState((prev) => ({
        ...prev,
        error: error.message,
        showMatchingReview: false, // Return to main view to show error
        isImporting: false,
      }));
    }
  };

  /**
   * Export current recipe to BeerXML
   */
  const exportToBeerXML = async (): Promise<void> => {
    if (!recipe || !ingredients || !onExport) return;

    setExportState((prev) => ({
      ...prev,
      isExporting: true,
      error: null,
    }));

    try {
      const result = await beerXMLService.exportRecipe(recipe.id);

      // Download file
      beerXMLService.downloadBeerXML(result.xmlContent, result.filename);

      if (onExport) {
        onExport({ success: true, filename: result.filename });
      }

      setExportState((prev) => ({
        ...prev,
        isExporting: false,
      }));
    } catch (error: any) {
      console.error("Error exporting to BeerXML:", error);
      setExportState((prev) => ({
        ...prev,
        error: error.message,
        isExporting: false,
      }));
    }
  };

  /**
   * Reset import state
   */
  const resetImport = (): void => {
    setImportState({
      isImporting: false,
      uploadedFile: null,
      parsedRecipes: [],
      selectedRecipe: null,
      matchingResults: [],
      showMatchingReview: false,
      error: null,
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Show ingredient matching review
  if (importState.showMatchingReview) {
    return (
      <IngredientMatchingReview
        matchingResults={importState.matchingResults}
        onComplete={completeImport}
        onCancel={() =>
          setImportState((prev) => ({ ...prev, showMatchingReview: false }))
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
                      importState.selectedRecipe
                    )}
                    onChange={(e) =>
                      setImportState((prev) => ({
                        ...prev,
                        selectedRecipe:
                          importState.parsedRecipes[parseInt(e.target.value)],
                      }))
                    }
                    className="form-select"
                  >
                    {importState.parsedRecipes.map((recipe, index) => (
                      <option key={index} value={index}>
                        {recipe?.recipe?.name || 'Unknown Recipe'} ({recipe?.ingredients?.length || 0}{" "}
                        ingredients)
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
                        {importState.selectedRecipe?.name || 'N/A'}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Style:</span>
                      <span className="value">
                        {importState.selectedRecipe?.style ||
                          "Not specified"}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Batch Size:</span>
                      <span className="value">
                        {importState.selectedRecipe?.batch_size?.toFixed(
                          0
                        ) || 'N/A'}{" "}
                        gal
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Ingredients:</span>
                      <span className="value">
                        {importState.selectedRecipe?.ingredients?.length || 0}
                      </span>
                    </div>
                  </div>

                  {/* Ingredient Summary */}
                  <div className="ingredient-summary">
                    <h6>Ingredients</h6>
                    <div className="ingredient-types">
                      {["grain", "hop", "yeast", "other"].map((type) => {
                        const count =
                          importState.selectedRecipe?.ingredients?.filter(
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
                      onClick={startIngredientMatching}
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
                exportState.isExporting || !recipe || !ingredients?.length
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