import React, { useState, useRef } from "react";
import beerXMLService from "../../services/BeerXML/BeerXMLService";
import IngredientMatchingReview from "./IngredientMatchingReview";
import { useUnits } from "../../contexts/UnitContext";
import "../../styles/BeerXMLImportExport.css";

const BeerXMLImportExport = ({
  recipe,
  ingredients,
  availableIngredients,
  onImport,
  onExport,
  mode = "both", // "import", "export", or "both"
}) => {
  const { unitSystem } = useUnits();
  const fileInputRef = useRef(null);

  // Import state
  const [importState, setImportState] = useState({
    isImporting: false,
    uploadedFile: null,
    parsedRecipes: [],
    selectedRecipe: null,
    matchingResults: [],
    showMatchingReview: false,
    error: null,
  });

  // Export state
  const [exportState, setExportState] = useState({
    isExporting: false,
    error: null,
  });

  /**
   * Handle file selection for import
   */
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
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
  const processBeerXMLFile = async () => {
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

      setImportState((prev) => ({
        ...prev,
        parsedRecipes,
        selectedRecipe: parsedRecipes[0] || null,
        isImporting: false,
      }));
    } catch (error) {
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
  const startIngredientMatching = async () => {
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
    } catch (error) {
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
  const completeImport = async (importResult) => {
    if (!importState.selectedRecipe || !onImport) return;

    try {
      // Handle both old and new structure for backwards compatibility
      const finalizedIngredients = importResult.ingredients || importResult;
      const createdIngredients = importResult.createdIngredients || [];

      await onImport({
        recipe: importState.selectedRecipe.recipe,
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
    } catch (error) {
      console.error("Error completing import:", error);
      setImportState((prev) => ({
        ...prev,
        error: error.message,
      }));
    }
  };

  /**
   * Export current recipe to BeerXML
   */
  const exportToBeerXML = async () => {
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
    } catch (error) {
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
  const resetImport = () => {
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
        availableIngredients={availableIngredients}
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
                        {recipe.recipe.name} ({recipe.ingredients.length}{" "}
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
                        {importState.selectedRecipe.recipe.name}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Style:</span>
                      <span className="value">
                        {importState.selectedRecipe.recipe.style ||
                          "Not specified"}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Batch Size:</span>
                      <span className="value">
                        {importState.selectedRecipe.recipe.batch_size.toFixed(
                          1
                        )}{" "}
                        gal
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Ingredients:</span>
                      <span className="value">
                        {importState.selectedRecipe.ingredients.length}
                      </span>
                    </div>
                  </div>

                  {/* Ingredient Summary */}
                  <div className="ingredient-summary">
                    <h6>Ingredients</h6>
                    <div className="ingredient-types">
                      {["grain", "hop", "yeast", "other"].map((type) => {
                        const count =
                          importState.selectedRecipe.ingredients.filter(
                            (ing) => ing.type === type
                          ).length;
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
                  {ingredients.length} ingredients • {recipe.batch_size}{" "}
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
