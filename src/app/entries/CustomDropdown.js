import { useState, useRef, useEffect } from "react";
import styles from "./customDropdown.module.css";

export default function CustomDropdown({
  options = [],
  value,
  onChange,
  status,
  disabled = false,
  className = "",
  buttonClassName = "",
  getLabel = (option) => option.name || option,
  getValue = (option) => option.name || option,
  placeholder = "Select option",
  defaultOption = null,
  searchable = false,
  searchPlaceholder = "Search...",
  searchKeywords,
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchText, setSearchText] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    if (disabled) {
      setShowDropdown(false);
      setSearchText("");
    }
  }, [disabled]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showDropdown]);

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setShowDropdown(false);
    setSearchText("");
  };

  const getDisplayValue = () => {
    if (defaultOption && value === defaultOption.value) {
      return defaultOption.label;
    }
    const selected = options.find((option) => getValue(option) === value);
    return selected ? getLabel(selected) : placeholder;
  };

  const normalizeForSearch = (text) =>
    String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  const normalizedSearch = searchText.trim().toLowerCase();
  const normalizedSearchCompact = normalizeForSearch(searchText);
  const filteredOptions =
    searchable && normalizedSearch
      ? options.filter((option) =>
          [
            String(getLabel(option)).toLowerCase(),
            ...(typeof searchKeywords === "function"
              ? searchKeywords(option).map((keyword) => String(keyword || "").toLowerCase())
              : []),
          ].some((candidate) => {
            const plain = String(candidate || "");
            if (plain.includes(normalizedSearch)) return true;
            return normalizeForSearch(plain).includes(normalizedSearchCompact);
          })
        )
      : options;

  return (
    <div
      className={`${styles.customDropdownContainer} ${className}`.trim()}
      ref={containerRef}
    >
      <button
        type="button"
        className={`${styles.dropdownInput} ${
          disabled ? styles.dropdownInputDisabled : ""
        } ${buttonClassName}`.trim()}
        disabled={disabled}
        onClick={(e) => {
          if (disabled) return;
          e.stopPropagation();
          setShowDropdown((prev) => {
            if (prev) {
              setSearchText("");
            }
            return !prev;
          });
        }}
      >
        <span>{getDisplayValue()}</span>
        <span className={styles.chevron}>{showDropdown ? "▲" : "▼"}</span>
      </button>

      {showDropdown && !disabled && (
        <div className={styles.dropdownModal}>
          {searchable && (
            <input
              type="text"
              className={styles.searchInput}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={searchPlaceholder}
              autoFocus
            />
          )}
          <div className={styles.dropdownList}>
            {defaultOption && (
              <button
                type="button"
                className={`${styles.option} ${value === defaultOption.value ? styles.selected : ""}`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleSelect(defaultOption.value);
                }}
              >
                {defaultOption.label}
              </button>
            )}

            {filteredOptions.map((option, index) => (
              <button
                key={index}
                type="button"
                className={`${styles.option} ${value === getValue(option) ? styles.selected : ""}`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleSelect(getValue(option));
                }}
              >
                {getLabel(option)}
              </button>
            ))}
            {filteredOptions.length === 0 && (
              <div className={styles.emptyState}>No options found</div>
            )}
          </div>
        </div>
      )}

      {status === "loading" && (
        <span className={styles.helper}>Loading...</span>
      )}
      {status === "error" && (
        <span className={styles.helperError}>
          Unable to load options.
        </span>
      )}
    </div>
  );
}
