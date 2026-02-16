"use client";

import styles from "./NotesPreview.module.css";

export default function NotesPreview({
  text,
  fallback = "-",
  maxWidth = 260,
  className = "",
}) {
  const normalized = String(text ?? "").trim();
  const displayText = normalized || fallback;
  const tooltipText = normalized || "";

  return (
    <span
      className={`${styles.notesCell}${className ? ` ${className}` : ""}`}
      title={tooltipText || undefined}
      data-full-text={tooltipText}
      data-has-tooltip={tooltipText ? "true" : "false"}
      style={{ "--notes-max-width": `${maxWidth}px` }}
    >
      <span className={styles.notesText}>{displayText}</span>
    </span>
  );
}
