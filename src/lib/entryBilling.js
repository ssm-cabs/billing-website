const SLOT_LIMITS = {
  "4hr": { hours: 4, kms: 40 },
  "8hr": { hours: 8, kms: 80 },
};

const toNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const roundCurrency = (value) => Math.round(Number(value) || 0);

function getMinutes(timeValue = "") {
  const value = String(timeValue || "").trim();
  if (!value) return null;

  // Accept both 24h (`HH:mm`) and 12h (`h:mm AM/PM`) formats.
  const normalized = value.replace(/\s+/g, " ").toUpperCase();
  const ampmMatch = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s?(AM|PM)$/);
  if (ampmMatch) {
    let hour = Number(ampmMatch[1]);
    const minute = ampmMatch[2] === undefined ? 0 : Number(ampmMatch[2]);
    const period = ampmMatch[3];
    if (
      !Number.isInteger(hour) ||
      !Number.isInteger(minute) ||
      hour < 1 ||
      hour > 12 ||
      minute < 0 ||
      minute > 59
    ) {
      return null;
    }
    if (hour === 12) hour = 0;
    if (period === "PM") hour += 12;
    return hour * 60 + minute;
  }

  const [hourRaw, minuteRaw] = normalized.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  return hour * 60 + minute;
}

export function getSlotLimits(slot = "") {
  return SLOT_LIMITS[slot] || null;
}

export function computeExtraUsage({
  slot = "",
  start_time = "",
  end_time = "",
  odometer_start = null,
  odometer_end = null,
} = {}) {
  const limits = getSlotLimits(slot);

  const startMinutes = getMinutes(start_time);
  const endMinutes = getMinutes(end_time);
  const travelledMinutes =
    startMinutes !== null && endMinutes !== null
      ? endMinutes >= startMinutes
        ? endMinutes - startMinutes
        : endMinutes + 24 * 60 - startMinutes
      : null;
  const travelledHours = travelledMinutes === null ? null : travelledMinutes / 60;

  const odometerStart = toNumber(odometer_start);
  const odometerEnd = toNumber(odometer_end);
  const travelledKms =
    odometerStart !== null && odometerEnd !== null && odometerEnd >= odometerStart
      ? odometerEnd - odometerStart
      : null;

  const extraHours =
    limits && travelledHours !== null
      ? Math.max(0, Math.ceil(travelledHours - limits.hours))
      : 0;
  const extraKms =
    limits && travelledKms !== null
      ? Math.max(0, Math.ceil(travelledKms - limits.kms))
      : 0;

  return {
    limits,
    travelledMinutes,
    travelledHours,
    travelledKms,
    extraHours,
    extraKms,
  };
}

export function computeEntryBilling({
  slot = "",
  rate = 0,
  extra_per_hour = 0,
  extra_per_km = 0,
  tolls = 0,
  start_time = "",
  end_time = "",
  odometer_start = null,
  odometer_end = null,
} = {}) {
  const usage = computeExtraUsage({
    slot,
    start_time,
    end_time,
    odometer_start,
    odometer_end,
  });

  const baseRate = Math.max(0, toNumber(rate) ?? 0);
  const extraPerHour = Math.max(0, toNumber(extra_per_hour) ?? 0);
  const extraPerKm = Math.max(0, toNumber(extra_per_km) ?? 0);
  const tollCharge = Math.max(0, toNumber(tolls) ?? 0);

  const extraTimeCost = roundCurrency(usage.extraHours * extraPerHour);
  const extraKmsCost = roundCurrency(usage.extraKms * extraPerKm);
  const total = roundCurrency(baseRate + extraTimeCost + extraKmsCost + tollCharge);

  return {
    ...usage,
    rate: roundCurrency(baseRate),
    extra_per_hour: roundCurrency(extraPerHour),
    extra_per_km: roundCurrency(extraPerKm),
    tolls: roundCurrency(tollCharge),
    extra_time_cost: extraTimeCost,
    extra_kms_cost: extraKmsCost,
    total,
  };
}
