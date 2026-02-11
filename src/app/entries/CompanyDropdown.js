import { useState, useRef, useEffect } from "react";
import styles from "./companyDropdown.module.css";

export default function CompanyDropdown({ companies, value, onChange, status }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef(null);

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

  const handleSelectCompany = (companyValue) => {
    onChange(companyValue);
    setShowDropdown(false);
  };

  const getDisplayValue = () => {
    if (value === "all") return "All Companies";
    const selected = companies.find((c) => c.name === value);
    return selected ? selected.name : "Select company";
  };

  return (
    <div className={styles.companyDropdownContainer} ref={containerRef}>
      <button
        type="button"
        className={styles.dropdownInput}
        onClick={(e) => {
          e.stopPropagation();
          setShowDropdown(!showDropdown);
        }}
      >
        <span>{getDisplayValue()}</span>
        <span className={styles.chevron}>{showDropdown ? "▲" : "▼"}</span>
      </button>

      {showDropdown && (
        <div className={styles.dropdownModal}>
          <div className={styles.dropdownList}>
            <button
              type="button"
              className={`${styles.option} ${value === "all" ? styles.selected : ""}`}
              onMouseDown={(e) => {
                e.stopPropagation();
                handleSelectCompany("all");
              }}
            >
              All Companies
            </button>

            {companies.map((company) => (
              <button
                key={company.company_id}
                type="button"
                className={`${styles.option} ${value === company.name ? styles.selected : ""}`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleSelectCompany(company.name);
                }}
              >
                {company.name}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={styles.closeButton}
            onMouseDown={(e) => {
              e.stopPropagation();
              setShowDropdown(false);
            }}
          >
            Close
          </button>
        </div>
      )}

      {status === "loading" && (
        <span className={styles.helper}>Loading companies...</span>
      )}
      {status === "error" && (
        <span className={styles.helperError}>
          Unable to load companies.
        </span>
      )}
    </div>
  );
}
