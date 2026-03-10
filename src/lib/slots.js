export const SLOT_VALUES = ["4hr", "8hr", "24hr"];

export const SLOT_OPTIONS = SLOT_VALUES.map((slot) => ({
  label: slot,
  value: slot,
}));

export const SLOT_LIMITS = {
  "4hr": { hours: 4, kms: 40 },
  "8hr": { hours: 8, kms: 80 },
  "24hr": { hours: 24, kms: 300 },
};
