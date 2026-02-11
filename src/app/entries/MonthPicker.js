import { useState, useRef, useEffect } from "react";
import styles from "./monthPicker.module.css";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function MonthPicker({ value, onChange }) {
  const [showPicker, setShowPicker] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowPicker(false);
      }
    };

    if (showPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showPicker]);
  const [displayYear, setDisplayYear] = useState(() => {
    if (value) {
      const [year] = value.split("-");
      return parseInt(year);
    }
    return new Date().getFullYear();
  });

  const handlePrevYear = () => {
    setDisplayYear((prev) => prev - 1);
  };

  const handleNextYear = () => {
    setDisplayYear((prev) => prev + 1);
  };

  const handleSelectMonth = (month) => {
    const monthStr = String(month + 1).padStart(2, "0");
    onChange(`${displayYear}-${monthStr}`);
    setShowPicker(false);
  };

  const getCurrentMonth = () => {
    if (value) {
      const [, month] = value.split("-");
      return parseInt(month) - 1;
    }
    return -1;
  };

  const getDisplayValue = () => {
    if (value) {
      const [year, month] = value.split("-");
      return `${months[parseInt(month) - 1]} ${year}`;
    }
    return "Select month";
  };

  const currentMonth = getCurrentMonth();

  return (
    <div className={styles.monthPickerContainer} ref={containerRef}>
      <input
        type="text"
        value={getDisplayValue()}
        readOnly
        onClick={() => setShowPicker(!showPicker)}
        className={styles.monthInput}
        placeholder="Select month"
      />

      {showPicker && (
        <div className={styles.pickerModal}>
          <div className={styles.pickerHeader}>
            <button
              type="button"
              className={styles.navButton}
              onClick={handlePrevYear}
            >
              ←
            </button>
            <span className={styles.year}>
              {displayYear}
            </span>
            <button
              type="button"
              className={styles.navButton}
              onClick={handleNextYear}
            >
              →
            </button>
          </div>

          <div className={styles.monthGrid}>
            {months.map((month, index) => (
              <button
                key={month}
                type="button"
                className={`${styles.monthButton} ${
                  currentMonth === index ? styles.selected : ""
                }`}
                onClick={() => handleSelectMonth(index)}
              >
                {month.substring(0, 3)}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={styles.closeButton}
            onClick={() => setShowPicker(false)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
