import React, { useState, useRef, useEffect, useMemo } from "react";
import Fuse from "fuse.js";

const SearchableSelect = ({
  options = [],
  value = "",
  onChange,
  onSelect,
  placeholder = "Search...",
  searchKey = "name",
  displayKey = "name",
  valueKey = "ingredient_id",
  disabled = false,
  className = "",
  maxResults = 100,
  minQueryLength = 1,
  // New prop to control the component from outside
  resetTrigger = null,
  // Fuse.js specific options
  fuseOptions = {},
}) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [searchResults, setSearchResults] = useState([]);

  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const optionRefs = useRef([]);

  // Reset component when resetTrigger changes
  useEffect(() => {
    if (resetTrigger !== null) {
      setQuery("");
      setIsOpen(false);
      setHighlightedIndex(-1);
      setSearchResults([]);
    }
  }, [resetTrigger]);

  // Create Fuse instance with optimized options
  const fuse = useMemo(() => {
    const defaultFuseOptions = {
      // Keys to search in
      keys: [
        {
          name: searchKey,
          weight: 1.0, // Primary search field
        },
        {
          name: "description",
          weight: 0.3, // Secondary search field
        },
        {
          name: "manufacturer",
          weight: 0.2, // Tertiary search field (for yeast)
        },
      ],

      // Search configuration
      threshold: 0.4, // 0.0 = exact match, 1.0 = match anything
      distance: 50, // How far from the beginning of text to search
      minMatchCharLength: 1,

      // Result configuration
      includeScore: false,
      includeMatches: true, // For highlighting matched text

      // Performance
      ignoreLocation: true, // Search entire string, not just beginning
      useExtendedSearch: false,

      // Merge with user-provided options
      ...fuseOptions,
    };

    return new Fuse(options, defaultFuseOptions);
  }, [options, searchKey, fuseOptions]);

  // Sort options alphabetically for when no query is present
  const sortedOptions = useMemo(() => {
    return [...options].sort((a, b) => {
      const nameA = (a[displayKey] || "").toLowerCase();
      const nameB = (b[displayKey] || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [options, displayKey]);

  // Search with Fuse.js
  useEffect(() => {
    if (query.length >= minQueryLength) {
      const results = fuse.search(query);

      // Extract items from Fuse results and limit results
      const processedResults = results.slice(0, maxResults).map((result) => ({
        item: result.item,
        score: result.score,
        matches: result.matches || [],
      }));

      setSearchResults(processedResults);
      setHighlightedIndex(0);
    } else if (query.length === 0) {
      // Show ALL options when no query, sorted alphabetically
      const allResults = sortedOptions.map((item) => ({
        item,
        score: 0,
        matches: [],
      }));
      setSearchResults(allResults);
      setHighlightedIndex(-1);
    } else {
      setSearchResults([]);
      setHighlightedIndex(-1);
    }
  }, [query, fuse, maxResults, minQueryLength, sortedOptions]);

  // Handle input change
  const handleInputChange = (e) => {
    const newQuery = e.target.value;
    setQuery(newQuery);

    if (onChange) {
      onChange(newQuery);
    }

    if (!isOpen && newQuery.length >= minQueryLength) {
      setIsOpen(true);
    }
  };

  // Handle option selection
  const handleOptionSelect = (resultItem) => {
    const option = resultItem.item || resultItem;
    setQuery(option[displayKey]);
    setIsOpen(false);
    setHighlightedIndex(-1);

    if (onSelect) {
      onSelect(option);
    }
  };

  // Handle keyboard navigation
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
          prev < searchResults.length - 1 ? prev + 1 : 0
        );
        break;

      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : searchResults.length - 1
        );
        break;

      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && searchResults[highlightedIndex]) {
          handleOptionSelect(searchResults[highlightedIndex]);
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

  // Handle input focus
  const handleFocus = () => {
    setIsOpen(true);
  };

  // Clear selection
  const handleClear = () => {
    setQuery("");
    setIsOpen(false);
    setHighlightedIndex(-1);
    if (onChange) {
      onChange("");
    }
    if (onSelect) {
      onSelect(null);
    }
    inputRef.current?.focus();
  };

  // Improved highlight function that respects word boundaries
  const highlightMatches = (text, matches = []) => {
    if (!matches.length || !query) return text;

    // Simple approach: highlight the exact search query if it appears
    const searchTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length > 0);

    let highlightedText = text;

    searchTerms.forEach((term) => {
      // Create a regex that matches the term with word boundaries or at the start of words
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

  return (
    <div className={`searchable-select ${className}`}>
      <div className="searchable-select-input-container">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          className="searchable-select-input"
          autoComplete="off"
          spellCheck="false"
        />

        {query && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="searchable-select-clear"
            title="Clear selection"
          >
            ×
          </button>
        )}

        <div className="searchable-select-arrow">
          <svg width="12" height="8" viewBox="0 0 12 8" fill="currentColor">
            <path d="M6 8L0 2h12L6 8z" />
          </svg>
        </div>
      </div>

      {isOpen && searchResults.length > 0 && (
        <div ref={dropdownRef} className="searchable-select-dropdown">
          {searchResults.map((result, index) => {
            const option = result.item;
            const matches = result.matches || [];

            return (
              <div
                key={option[valueKey] || index}
                ref={(el) => (optionRefs.current[index] = el)}
                className={`searchable-select-option ${
                  index === highlightedIndex ? "highlighted" : ""
                }`}
                onClick={() => handleOptionSelect(result)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <div
                  className="option-name"
                  dangerouslySetInnerHTML={{
                    __html: highlightMatches(option[displayKey], matches),
                  }}
                />

                {option.description && (
                  <div
                    className="option-description"
                    dangerouslySetInnerHTML={{
                      __html: highlightMatches(option.description, matches),
                    }}
                  />
                )}

                {option.manufacturer && (
                  <div className="option-manufacturer">
                    ({highlightMatches(option.manufacturer, matches)})
                  </div>
                )}
              </div>
            );
          })}

          {query.length >= minQueryLength && searchResults.length === 0 && (
            <div className="searchable-select-no-results">
              No ingredients found matching "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
