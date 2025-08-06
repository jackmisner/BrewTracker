import React, { useState, useEffect, useMemo, useRef } from "react";
import Fuse from "fuse.js";
import { Services } from "@/services";
import StyleAnalysis from "./StyleAnalysis";
import { Recipe, RecipeMetrics } from "@/types";
import { BeerStyleGuide, StyleSuggestion } from "@/types/beer-styles";

interface EnhancedBeerStyle extends BeerStyleGuide {
  display_name: string;
  category_name: string;
  matches?: any[];
}

interface FuseOptions {
  keys: Array<{
    name: string;
    weight: number;
  }>;
  threshold: number;
  distance: number;
  minMatchCharLength: number;
  includeScore: boolean;
  includeMatches: boolean;
  ignoreLocation: boolean;
  useExtendedSearch: boolean;
}

interface BeerStyleSelectorProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showStyleInfo?: boolean;
  disabled?: boolean;
  recipe?: Recipe;
  maxResults?: number;
  minQueryLength?: number;
  metrics?: RecipeMetrics | null;
  showSuggestions?: boolean;
  onStyleSuggestionSelect?: ((styleName: string) => void) | null;
}

const BeerStyleSelector: React.FC<BeerStyleSelectorProps> = ({
  value,
  onChange,
  placeholder = "Select or search beer style...",
  showStyleInfo = true,
  disabled = false,
  recipe,
  maxResults = 50,
  minQueryLength = 0,
  metrics = null,
  showSuggestions = false,
  onStyleSuggestionSelect = null,
}) => {
  const [styles, setStyles] = useState<EnhancedBeerStyle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>(value || "");
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [selectedStyle, setSelectedStyle] = useState<EnhancedBeerStyle | null>(
    null
  );
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<StyleSuggestion[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Create Fuse instance for fuzzy search
  const fuse = useMemo(() => {
    if (styles.length === 0) return null;

    const fuseOptions: FuseOptions = {
      keys: [
        {
          name: "name",
          weight: 1.0,
        },
        {
          name: "style_id",
          weight: 0.8,
        },
        {
          name: "category_name",
          weight: 0.6,
        },
        {
          name: "overall_impression",
          weight: 0.4,
        },
        {
          name: "tags",
          weight: 0.3,
        },
      ],
      threshold: 0.4,
      distance: 100,
      minMatchCharLength: 1,
      includeScore: false,
      includeMatches: true,
      ignoreLocation: true,
      useExtendedSearch: false,
    };

    return new Fuse(styles, fuseOptions);
  }, [styles]);

  // Load styles on mount
  useEffect(() => {
    const loadStyles = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);

        const allStyles = await Services.beerStyle.getAllStylesList();

        if (allStyles.length === 0) {
          setError(
            "No beer styles available. Please check your database connection."
          );
        } else {
          setStyles(allStyles);

          // Find currently selected style
          if (value) {
            const currentStyle = allStyles.find(
              style =>
                style.name.toLowerCase() === value.toLowerCase() ||
                style.display_name.toLowerCase().includes(value.toLowerCase())
            );
            setSelectedStyle(currentStyle || null);
          }
        }
      } catch (error: any) {
        console.error("Error loading beer styles:", error);
        setError("Failed to load beer styles. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    loadStyles();
  }, [value]);

  useEffect(() => {
    const loadSuggestions = async (): Promise<void> => {
      if (showSuggestions && metrics && !selectedStyle) {
        try {
          const suggestionsResult =
            await Services.beerStyle.findMatchingStyles(metrics);
          setSuggestions(suggestionsResult.slice(0, 5));
        } catch (error: any) {
          console.error("Error loading style suggestions:", error);
          setSuggestions([]);
        }
      } else {
        setSuggestions([]);
      }
    };

    loadSuggestions();
  }, [showSuggestions, metrics, selectedStyle]);

  // Filter styles based on search term
  const filteredStyles = useMemo(() => {
    if (!fuse || loading) return [];

    if (!searchTerm || searchTerm.length < minQueryLength) {
      return styles; // Show all styles when no search term
    }

    const results = fuse.search(searchTerm);
    return results.slice(0, maxResults).map((result: any) => ({
      ...result.item,
      matches: result.matches || [],
    }));
  }, [fuse, searchTerm, styles, loading, minQueryLength, maxResults]);

  // Highlight matches in text
  const highlightMatches = (text: string, matches: any[] = []): string => {
    if (!matches.length || !searchTerm) return text;

    const searchTerms = searchTerm
      .toLowerCase()
      .split(/\s+/)
      .filter(term => term.length > 0);

    let highlightedText = text;

    searchTerms.forEach(term => {
      const regex = new RegExp(
        `(\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
        "gi"
      );
      highlightedText = highlightedText.replace(
        regex,
        '<mark class="search-highlight">$1</mark>'
      );
    });

    return highlightedText;
  };

  const handleStyleSelect = (style: EnhancedBeerStyle): void => {
    setSelectedStyle(style);
    setSearchTerm(style.name);
    setIsOpen(false);
    setHighlightedIndex(-1);
    onChange(style.name);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    setIsOpen(true);
    setHighlightedIndex(-1);

    if (!newValue) {
      setSelectedStyle(null);
      onChange("");
    } else {
      const directMatch = styles.find(
        style => style.name.toLowerCase() === newValue.toLowerCase()
      );
      if (directMatch) {
        setSelectedStyle(directMatch);
      } else {
        onChange(newValue);
      }
    }
  };

  const handleInputFocus = (): void => {
    setIsOpen(true);
  };

  const handleInputBlur = (): void => {
    setTimeout(() => setIsOpen(false), 200);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredStyles.length - 1 ? prev + 1 : 0
        );
        break;

      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : filteredStyles.length - 1
        );
        break;

      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredStyles[highlightedIndex]) {
          handleStyleSelect(filteredStyles[highlightedIndex]);
        }
        break;

      case "Escape":
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;

      default:
        break;
    }
  };

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && optionRefs.current[highlightedIndex]) {
      optionRefs.current[highlightedIndex]?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [highlightedIndex]);

  useEffect(() => {
    setSearchTerm(value || "");
  }, [value]);

  if (loading) {
    return (
      <div className="beer-style-selector loading">
        <input
          type="text"
          className="form-control"
          placeholder="Loading styles..."
          disabled
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="beer-style-selector error">
        <input
          type="text"
          className="form-control"
          placeholder={placeholder}
          value={searchTerm}
          onChange={handleInputChange}
          disabled={disabled}
        />
        <div className="error-message">
          <small className="text-danger">{error}</small>
        </div>
      </div>
    );
  }

  return (
    <div className="beer-style-selector">
      <div className="style-input-container">
        <input
          ref={inputRef}
          role="combobox"
          aria-controls="beer-style-listbox"
          aria-expanded={isOpen}
          type="text"
          className="form-control"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          spellCheck="false"
        />

        {searchTerm && !disabled && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              setSelectedStyle(null);
              onChange("");
              inputRef.current?.focus();
            }}
            className="clear-button"
            title="Clear selection"
          >
            ×
          </button>
        )}

        {isOpen && filteredStyles.length > 0 && (
          <div ref={dropdownRef} className="style-dropdown">
            {filteredStyles.map((style, index) => (
              <div
                key={style.style_guide_id || style.style_id}
                ref={el => {
                  optionRefs.current[index] = el;
                }}
                className={`style-option ${
                  index === highlightedIndex ? "highlighted" : ""
                }`}
                onClick={() => handleStyleSelect(style)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <div className="style-option-main">
                  <span
                    className="style-id"
                    dangerouslySetInnerHTML={{
                      __html: highlightMatches(style.style_id, style.matches),
                    }}
                  />
                  <span
                    className="style-name"
                    dangerouslySetInnerHTML={{
                      __html: highlightMatches(style.name, style.matches),
                    }}
                  />
                </div>
                <div
                  className="style-category"
                  dangerouslySetInnerHTML={{
                    __html: highlightMatches(
                      style.category_name,
                      style.matches
                    ),
                  }}
                />
              </div>
            ))}

            {searchTerm.length >= minQueryLength &&
              filteredStyles.length === 0 && (
                <div className="no-results">
                  No styles found matching "{searchTerm}"
                </div>
              )}
          </div>
        )}
      </div>

      {showStyleInfo && selectedStyle && (
        <div className="selected-style-info">
          <div className="style-info-header">
            <h4>
              {selectedStyle.style_id} - {selectedStyle.name}
            </h4>
            <span className="style-category">
              {selectedStyle.category_name}
            </span>
          </div>

          {selectedStyle.overall_impression && (
            <p className="style-impression">
              {selectedStyle.overall_impression}
            </p>
          )}
          <StyleAnalysis
            recipe={recipe}
            metrics={metrics ?? undefined}
            onStyleSuggestionSelect={() => {}}
            variant="main"
            data-testid="style-analysis"
          />
        </div>
      )}

      {/* Style suggestions when no style is selected */}
      {showSuggestions && !selectedStyle && metrics && (
        <div className="style-suggestions">
          <h4>Suggested Styles Based on Current Recipe</h4>
          {suggestions.length > 0 ? (
            <div className="suggestions-list">
              {suggestions.slice(0, 3).map((suggestion, index) => (
                <div key={index} className="suggestion-item">
                  <div className="suggestion-header">
                    <div className="style-info">
                      <span className="style-id">
                        {suggestion.style.style_id}
                      </span>
                      <span className="style-name">
                        {suggestion.style.name}
                      </span>
                    </div>
                    <div className="suggestion-actions">
                      <span className="match-score">
                        {Math.round(suggestion.match_percentage)}% match
                      </span>
                      <button
                        onClick={() => {
                          if (onStyleSuggestionSelect) {
                            onStyleSuggestionSelect(suggestion.style.name);
                          } else {
                            handleStyleSelect(
                              suggestion.style as EnhancedBeerStyle
                            );
                          }
                        }}
                        className="select-style-btn"
                      >
                        Select
                      </button>
                    </div>
                  </div>
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
              ))}
            </div>
          ) : (
            <p>
              No style suggestions available based on current recipe metrics.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default BeerStyleSelector;
