import { useState } from "react";
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

export default function DatePicker({ value, onChange }) {
  const [showPicker, setShowPicker] = useState(false);
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
    onChange(`${year}-${month}-${date}`);
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
      const isSelected =
        value ===
        `${displayYear}-${String(displayMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      days.push(
        <button
          key={day}
          type="button"
          className={`${styles.day} ${isSelected ? styles.selected : ""}`}
          onClick={() => handleSelectDate(day)}
        >
          {day}
        </button>
      );
    }

    return days;
  };

  return (
    <div className={styles.datePickerContainer}>
      <input
        type="text"
        value={value ? new Date(value).toLocaleDateString() : ""}
        readOnly
        onClick={() => setShowPicker(!showPicker)}
        className={styles.dateInput}
        placeholder="Select date"
      />
      
      {showPicker && (
        <div className={styles.pickerModal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.pickerHeader}>
            <button
              type="button"
              className={styles.navButton}
              onClick={handlePrevMonth}
            >
              ←
            </button>
            <span className={styles.monthYear}>
              {months[displayMonth]} {displayYear}
            </span>
            <button
              type="button"
              className={styles.navButton}
              onClick={handleNextMonth}
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
            onClick={() => setShowPicker(false)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
