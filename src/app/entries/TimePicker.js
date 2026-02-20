import { useMemo } from "react";
import CustomDropdown from "./CustomDropdown";

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatTimeLabel(timeValue) {
  if (!timeValue) return "";

  const [hourRaw, minuteRaw] = String(timeValue).split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return String(timeValue);
  }

  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${pad(hour12)}:${pad(minute)} ${period}`;
}

function getTimeSearchKeywords(timeValue) {
  const [hourRaw, minuteRaw] = String(timeValue || "").split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return [];
  }

  const period = hour >= 12 ? "pm" : "am";
  const hour12 = hour % 12 || 12;
  const minutePadded = pad(minute);

  return [
    `${pad(hour)}:${minutePadded}`,
    `${hour}:${minutePadded}`,
    `${pad(hour12)}:${minutePadded} ${period}`,
    `${hour12}:${minutePadded} ${period}`,
    `${hour12}${period}`,
    `${hour12} ${period}`,
    minute === 0 ? `${hour12}${period}` : "",
  ].filter(Boolean);
}

export default function TimePicker({
  value,
  onChange,
  placeholder = "Select time",
  intervalMinutes = 15,
  disabled = false,
}) {
  const options = useMemo(() => {
    const safeInterval =
      Number.isFinite(intervalMinutes) && intervalMinutes > 0
        ? intervalMinutes
        : 15;

    const times = [];
    for (let minutes = 0; minutes < 24 * 60; minutes += safeInterval) {
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      times.push(`${pad(hour)}:${pad(minute)}`);
    }
    return times;
  }, [intervalMinutes]);

  return (
    <CustomDropdown
      options={options}
      value={value || ""}
      onChange={onChange}
      disabled={disabled}
      searchable
      searchPlaceholder="Search time"
      searchKeywords={getTimeSearchKeywords}
      getLabel={(option) => formatTimeLabel(option)}
      getValue={(option) => option}
      placeholder={placeholder}
      defaultOption={{ label: "Not set", value: "" }}
    />
  );
}
