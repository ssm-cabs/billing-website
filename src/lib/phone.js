export function normalizePhoneNumber(value = "") {
  const cleaned = String(value).replace(/\D/g, "");

  if (!cleaned) {
    return "";
  }

  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }

  if (cleaned.length === 11 && cleaned.startsWith("0")) {
    return `+91${cleaned.slice(1)}`;
  }

  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    return `+${cleaned}`;
  }

  return `+${cleaned}`;
}

export function isValidPhoneNumber(value = "") {
  return /^\+\d{10,15}$/.test(String(value).trim());
}
