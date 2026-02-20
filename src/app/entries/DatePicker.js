import { useState, useRef, useEffect } from "react";
import styles from "./datePicker.module.css";

const getDaysInMonth = (year, month) => {
  return new Date(year, month + 1, 0).getDate();
};

const getFirstDayOfMonth = (year, month) => {
  return new Date(year, month, 1).getDay();
};

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function DatePicker({ value, onChange, minDate = "" }) {
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
  const [displayMonth, setDisplayMonth] = useState(() => {
    if (value) {
      const [year, month] = value.split("-");
      return parseInt(month) - 1;
    }
    return new Date().getMonth();
  });
  const [displayYear, setDisplayYear] = useState(() => {
    if (value) {
      const [year] = value.split("-");
      return parseInt(year);
    }
    return new Date().getFullYear();
  });

  const handlePrevMonth = () => {
    setDisplayMonth((prev) => {
      if (prev === 0) {
        setDisplayYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  };

  const handleNextMonth = () => {
    setDisplayMonth((prev) => {
      if (prev === 11) {
        setDisplayYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  };

  const handleSelectDate = (day) => {
    const year = displayYear;
    const month = String(displayMonth + 1).padStart(2, "0");
    const date = String(day).padStart(2, "0");
    const selectedDate = `${year}-${month}-${date}`;
    if (minDate && selectedDate < minDate) {
      return;
    }
    onChange(selectedDate);
    setShowPicker(false);
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(displayYear, displayMonth);
    const firstDay = getFirstDayOfMonth(displayYear, displayMonth);
    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className={styles.emptyDay} />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const selectedDate = `${displayYear}-${String(displayMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const isSelected =
        value ===
        selectedDate;
      const isDisabled = Boolean(minDate) && selectedDate < minDate;
      days.push(
        <button
          key={day}
          type="button"
          className={`${styles.day} ${isSelected ? styles.selected : ""} ${isDisabled ? styles.dayDisabled : ""}`}
          disabled={isDisabled}
          onMouseDown={(e) => {
            e.stopPropagation();
            if (isDisabled) return;
            handleSelectDate(day);
          }}
        >
          {day}
        </button>
      );
    }

    return days;
  };

  return (
    <div className={styles.datePickerContainer} ref={containerRef}>
      <input
        type="text"
        value={value ? new Date(value).toLocaleDateString() : ""}
        readOnly
        onClick={(e) => {
          e.stopPropagation();
          setShowPicker(!showPicker);
        }}
        className={styles.dateInput}
        placeholder="Select date"
      />
      
      {showPicker && (
        <div className={styles.pickerModal}>
          <div className={styles.pickerHeader}>
            <button
              type="button"
              className={styles.navButton}
              onClick={(e) => {
                e.stopPropagation();
                handlePrevMonth();
              }}
            >
              ←
            </button>
            <span className={styles.monthYear}>
              {months[displayMonth]} {displayYear}
            </span>
            <button
              type="button"
              className={styles.navButton}
              onClick={(e) => {
                e.stopPropagation();
                handleNextMonth();
              }}
            >
              →
            </button>
          </div>

          <div className={styles.weekDays}>
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          <div className={styles.calendar}>{renderCalendar()}</div>

          <button
            type="button"
            className={styles.closeButton}
            onMouseDown={(e) => {
              e.stopPropagation();
              setShowPicker(false);
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
