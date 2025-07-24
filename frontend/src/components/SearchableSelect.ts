import React, { useState, useRef, useEffect, useMemo } from "react";
import Fuse from "fuse.js";
import { Ingredient } from "../types";

// Processed search result for internal use
interface ProcessedSearchResult<T> {
  item: T;
  score: number;
  matches: any[]; // Use any[] instead of Fuse.FuseResultMatch[] to avoid namespace issues
}

// Props interface
interface SearchableSelectProps<T = Ingredient> {
  options?: T[];
  value?: string;
  onChange?: (query: string) => void;
  onSelect?: (option: T | null) => void;
  placeholder?: string;
  searchKey?: keyof T | string;
  displayKey?: keyof T | string;
  valueKey?: keyof T | string;
  disabled?: boolean;
  className?: string;
  maxResults?: number;
  minQueryLength?: number;
  resetTrigger?: any;
  fuseOptions?: any; // Use any instead of Fuse.IFuseOptions to avoid namespace issues
}

const SearchableSelect = <T extends Record<string, any> = Ingredient>({
  options = [],
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
  resetTrigger = null,
  fuseOptions = {},
}: SearchableSelectProps<T>): React.ReactElement => {
  const [query, setQuery] = useState<string>("");
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [searchResults, setSearchResults] = useState<
    ProcessedSearchResult<T>[]
  >([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);

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
    const defaultFuseOptions: any = {
      // Keys to search in
      keys: [
        {
          name: searchKey as string,
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

  // Use options as provided (already sorted by service) for when no query is present

  // Search with Fuse.js
  useEffect(() => {
    if (query.length >= minQueryLength) {
      const results = fuse.search(query);

      // Extract items from Fuse results and limit results
      const processedResults: ProcessedSearchResult<T>[] = results
        .slice(0, maxResults)
        .map((result) => ({
          item: result.item,
          score: result.score || 0,
          matches: [...(result.matches || [])],
        }));

      setSearchResults(processedResults);
      setHighlightedIndex(0);
    } else if (query.length === 0) {
      // Show ALL options when no query, preserving original sorting from service
      const allResults: ProcessedSearchResult<T>[] = options.map(
        (item) => ({
          item,
          score: 0,
          matches: [],
        })
      );
      setSearchResults(allResults);
      setHighlightedIndex(-1);
    } else {
      setSearchResults([]);
      setHighlightedIndex(-1);
    }
  }, [query, fuse, maxResults, minQueryLength, options]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
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
  const handleOptionSelect = (
    resultItem: ProcessedSearchResult<T> | T
  ): void => {
    const option = "item" in resultItem ? resultItem.item : resultItem;
    setQuery(option[displayKey as keyof T] as string);
    setIsOpen(false);
    setHighlightedIndex(-1);

    if (onSelect) {
      onSelect(option);
    }
  };

  // Handle keyboard navigation
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
    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (
        inputRef.current &&
        !inputRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
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

  // Handle input focus
  const handleFocus = (): void => {
    setIsOpen(true);
  };

  // Clear selection
  const handleClear = (): void => {
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
  const highlightMatches = (text: string, matches: any[] = []): string => {
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

  return React.createElement(
    "div",
    { className: `searchable-select ${className}` },
    React.createElement(
      "div",
      { className: "searchable-select-input-container" },
      React.createElement("input", {
        ref: inputRef,
        type: "text",
        value: query,
        onChange: handleInputChange,
        onKeyDown: handleKeyDown,
        onFocus: handleFocus,
        placeholder: placeholder,
        disabled: disabled,
        className: "searchable-select-input",
        autoComplete: "off",
        spellCheck: false,
      }),

      query &&
        !disabled &&
        React.createElement(
          "button",
          {
            type: "button",
            "data-testid": "clear-button",
            onClick: handleClear,
            className: "searchable-select-clear",
            title: "Clear selection",
          },
          "×"
        ),

      React.createElement(
        "div",
        { className: "searchable-select-arrow" },
        React.createElement(
          "svg",
          {
            width: "12",
            height: "8",
            viewBox: "0 0 12 8",
            fill: "currentColor",
          },
          React.createElement("path", { d: "M6 8L0 2h12L6 8z" })
        )
      )
    ),

    isOpen &&
      searchResults.length > 0 &&
      React.createElement(
        "div",
        { ref: dropdownRef, className: "searchable-select-dropdown" },
        searchResults.map((result, index) => {
          const option = result.item;
          const matches = result.matches || [];

          return React.createElement(
            "div",
            {
              key: (option[valueKey as keyof T] as string) || index,
              ref: (el: HTMLDivElement | null) =>
                (optionRefs.current[index] = el),
              className: `searchable-select-option ${
                index === highlightedIndex ? "highlighted" : ""
              }`,
              onClick: () => handleOptionSelect(result),
              onMouseEnter: () => setHighlightedIndex(index),
            },
            React.createElement("div", {
              className: "option-name",
              dangerouslySetInnerHTML: {
                __html: highlightMatches(
                  option[displayKey as keyof T] as string,
                  matches
                ),
              },
            }),

            (option as any).description &&
              React.createElement("div", {
                className: "option-description",
                dangerouslySetInnerHTML: {
                  __html: highlightMatches(
                    (option as any).description,
                    matches
                  ),
                },
              }),

            (option as any).manufacturer &&
              React.createElement(
                "div",
                { className: "option-manufacturer" },
                `(${highlightMatches((option as any).manufacturer, matches)})`
              )
          );
        }),

        query.length >= minQueryLength &&
          searchResults.length === 0 &&
          React.createElement(
            "div",
            { className: "searchable-select-no-results" },
            `No ingredients found matching "${query}"`
          )
      )
  );
};

export default SearchableSelect;
