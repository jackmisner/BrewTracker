import React, { useState, useEffect, useMemo, useRef } from "react";
import Fuse from "fuse.js";
import BeerStyleService from "../../../services/BeerStyleService";
import StyleRangeIndicator from "./StyleRangeIndicator";
import {
  formatGravity,
  formatAbv,
  formatIbu,
  formatSrm,
} from "../../../utils/formatUtils";

function BeerStyleSelector({
  value,
  onChange,
  placeholder = "Select or search beer style...",
  showStyleInfo = true,
  disabled = false,
  maxResults = 50,
  minQueryLength = 0,
  metrics = null, // NEW: Add metrics prop for real-time analysis
  showSuggestions = false, // NEW: Show style suggestions when no style selected
  onStyleSuggestionSelect = null, // NEW: Callback for selecting suggested styles
}) {
  const [styles, setStyles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(value || "");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState([]); // NEW: Style suggestions

  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const optionRefs = useRef([]);

  // Create Fuse instance for fuzzy search
  const fuse = useMemo(() => {
    if (styles.length === 0) return null;

    const fuseOptions = {
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
    const loadStyles = async () => {
      try {
        setLoading(true);
        setError(null);

        const allStyles = await BeerStyleService.getAllStylesList();

        if (allStyles.length === 0) {
          setError(
            "No beer styles available. Please check your database connection."
          );
        } else {
          setStyles(allStyles);

          // Find currently selected style
          if (value) {
            const currentStyle = allStyles.find(
              (style) =>
                style.name.toLowerCase() === value.toLowerCase() ||
                style.display_name.toLowerCase().includes(value.toLowerCase())
            );
            setSelectedStyle(currentStyle);
          }
        }
      } catch (error) {
        console.error("Error loading beer styles:", error);
        setError("Failed to load beer styles. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    loadStyles();
  }, [value]);

  // NEW: Load style suggestions when no style is selected but metrics are available
  useEffect(() => {
    const loadSuggestions = async () => {
      if (showSuggestions && metrics && !selectedStyle) {
        try {
          const suggestionsResult = await BeerStyleService.findMatchingStyles(
            metrics
          );
          setSuggestions(suggestionsResult.slice(0, 5));
        } catch (error) {
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
      return styles.slice(0, maxResults);
    }

    const results = fuse.search(searchTerm);
    return results.slice(0, maxResults).map((result) => ({
      ...result.item,
      matches: result.matches || [],
    }));
  }, [fuse, searchTerm, styles, loading, minQueryLength, maxResults]);

  // NEW: Calculate style match for selected style and current metrics
  const styleMatch = useMemo(() => {
    if (!selectedStyle || !metrics) return null;
    return BeerStyleService.calculateStyleMatch(selectedStyle, metrics);
  }, [selectedStyle, metrics]);

  // Highlight matches in text
  const highlightMatches = (text, matches = []) => {
    if (!matches.length || !searchTerm) return text;

    const searchTerms = searchTerm
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length > 0);

    let highlightedText = text;

    searchTerms.forEach((term) => {
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

  const handleStyleSelect = (style) => {
    setSelectedStyle(style);
    setSearchTerm(style.name);
    setIsOpen(false);
    setHighlightedIndex(-1);
    onChange(style.name);
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    setIsOpen(true);
    setHighlightedIndex(-1);

    if (!newValue) {
      setSelectedStyle(null);
      onChange("");
    } else {
      const directMatch = styles.find(
        (style) => style.name.toLowerCase() === newValue.toLowerCase()
      );
      if (directMatch) {
        setSelectedStyle(directMatch);
      } else {
        onChange(newValue);
      }
    }
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleInputBlur = () => {
    setTimeout(() => setIsOpen(false), 200);
  };

  const handleKeyDown = (e) => {
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
        setHighlightedIndex((prev) =>
          prev < filteredStyles.length - 1 ? prev + 1 : 0
        );
        break;

      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
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
        inputRef.current?.blur();
        break;

      default:
        break;
    }
  };

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
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
      optionRefs.current[highlightedIndex].scrollIntoView({
        block: "nearest",
      });
    }
  }, [highlightedIndex]);

  // NEW: Helper function to get match status color
  const getMatchStatusColor = (matches) => {
    if (!matches) return "neutral";
    const matchCount = Object.values(matches).filter(Boolean).length;
    const totalSpecs = Object.keys(matches).length;
    const percentage = totalSpecs > 0 ? (matchCount / totalSpecs) * 100 : 0;

    if (percentage >= 80) return "success";
    if (percentage >= 60) return "warning";
    return "danger";
  };

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
                ref={(el) => (optionRefs.current[index] = el)}
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

          {/* NEW: Enhanced spec display with visual range indicators */}
          {metrics && styleMatch ? (
            <div className="style-specs-with-ranges">
              <div className="specs-header">
                <span className="specs-title">Style Analysis</span>
                <span
                  className={`match-indicator ${getMatchStatusColor(
                    styleMatch.matches
                  )}`}
                >
                  {Math.round(styleMatch.percentage)}% match
                </span>
              </div>

              <div className="range-indicators">
                {selectedStyle.original_gravity && (
                  <StyleRangeIndicator
                    metricType="og"
                    currentValue={metrics.og}
                    styleRange={selectedStyle.original_gravity}
                    label="Original Gravity"
                  />
                )}

                {selectedStyle.final_gravity && (
                  <StyleRangeIndicator
                    metricType="fg"
                    currentValue={metrics.fg}
                    styleRange={selectedStyle.final_gravity}
                    label="Final Gravity"
                  />
                )}

                {selectedStyle.alcohol_by_volume && (
                  <StyleRangeIndicator
                    metricType="abv"
                    currentValue={metrics.abv}
                    styleRange={selectedStyle.alcohol_by_volume}
                    label="Alcohol by Volume"
                    unit="%"
                  />
                )}

                {selectedStyle.international_bitterness_units && (
                  <StyleRangeIndicator
                    metricType="ibu"
                    currentValue={metrics.ibu}
                    styleRange={selectedStyle.international_bitterness_units}
                    label="International Bitterness Units"
                  />
                )}

                {selectedStyle.color && (
                  <StyleRangeIndicator
                    metricType="srm"
                    currentValue={metrics.srm}
                    styleRange={selectedStyle.color}
                    label="Color (SRM)"
                    showColorSwatch={true}
                  />
                )}
              </div>
            </div>
          ) : (
            /* Fallback to simple specs display when no metrics */
            <div className="style-specs">
              {selectedStyle.original_gravity && (
                <span className="spec">
                  OG:{" "}
                  {BeerStyleService.formatStyleRange(
                    selectedStyle.original_gravity,
                    3
                  )}
                </span>
              )}
              {selectedStyle.final_gravity && (
                <span className="spec">
                  FG:{" "}
                  {BeerStyleService.formatStyleRange(
                    selectedStyle.final_gravity,
                    3
                  )}
                </span>
              )}
              {selectedStyle.alcohol_by_volume && (
                <span className="spec">
                  ABV:{" "}
                  {BeerStyleService.formatStyleRange(
                    selectedStyle.alcohol_by_volume,
                    1
                  )}
                  %
                </span>
              )}
              {selectedStyle.international_bitterness_units && (
                <span className="spec">
                  IBU:{" "}
                  {BeerStyleService.formatStyleRange(
                    selectedStyle.international_bitterness_units,
                    0
                  )}
                </span>
              )}
              {selectedStyle.color && (
                <span className="spec">
                  SRM:{" "}
                  {BeerStyleService.formatStyleRange(selectedStyle.color, 1)}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* NEW: Style suggestions when no style is selected */}
      {showSuggestions &&
        !selectedStyle &&
        suggestions.length > 0 &&
        metrics && (
          <div className="style-suggestions">
            <h4>Suggested Styles Based on Current Recipe</h4>
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
                        {Math.round(suggestion.match.percentage)}% match
                      </span>
                      <button
                        onClick={() => {
                          if (onStyleSuggestionSelect) {
                            onStyleSuggestionSelect(suggestion.style.name);
                          } else {
                            handleStyleSelect(suggestion.style);
                          }
                        }}
                        className="select-style-btn"
                      >
                        Select
                      </button>
                    </div>
                  </div>
                  <div className="match-breakdown">
                    {Object.entries(suggestion.match.matches).map(
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
          </div>
        )}
    </div>
  );
}

export default BeerStyleSelector;
