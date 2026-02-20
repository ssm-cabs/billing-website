import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  deleteField,
  limit,
  orderBy,
  query,
  startAfter,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  where,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";
import { computeEntryBilling } from "./entryBilling";

const mockEntries = [
  {
    entry_id: "ENT-2401",
    entry_date: "2026-02-10",
    entry_month: "2026-02",
    company_id: "acme-corp",
    company_name: "Acme Corp",
    vehicle_id: "tn-09-ab-1234",
    cab_type: "SUV",
    slot: "8hr",
    pickup_location: "T Nagar",
    drop_location: "Guindy",
    user_name: "Arun",
    vehicle_number: "TN 09 AB 1234",
    notes: "Airport pickup",
  },
  {
    entry_id: "ENT-2402",
    entry_date: "2026-02-10",
    entry_month: "2026-02",
    company_id: "globex",
    company_name: "Globex",
    vehicle_id: "tn-10-cd-5678",
    cab_type: "Sedan",
    slot: "4hr",
    pickup_location: "Velachery",
    drop_location: "Nungambakkam",
    user_name: "Suresh",
    vehicle_number: "TN 10 CD 5678",
    notes: "",
  },
];

const mockCompanies = [
  {
    company_id: "acme-corp",
    name: "Acme Corp",
    billing_cycle: "monthly",
    contact_name: "Ravi",
    contact_phone: "+91 90000 00001",
    address: "T Nagar, Chennai",
    phone: "+91 44 4200 0001",
    email: "billing@acmecorp.com",
    bank_details: "Account: 1234567890 | HDFC Bank | IFSC: HDFC0001234",
    active: true,
  },
  {
    company_id: "globex",
    name: "Globex",
    billing_cycle: "monthly",
    contact_name: "Meera",
    contact_phone: "+91 90000 00002",
    address: "Guindy, Chennai",
    phone: "+91 44 4200 0002",
    email: "accounts@globex.com",
    bank_details: "Account: 9876543210 | ICICI Bank | IFSC: ICIC0002468",
    active: true,
  },
];

const mockPricing = {
  "acme-corp": [
    {
      pricing_id: "p1",
      cab_type: "SUV",
      slot: "8hr",
      rate: 2400,
      extra_per_hour: 300,
      extra_per_km: 20,
    },
    {
      pricing_id: "p2",
      cab_type: "Sedan",
      slot: "4hr",
      rate: 1200,
      extra_per_hour: 250,
      extra_per_km: 18,
    },
  ],
  globex: [
    {
      pricing_id: "p3",
      cab_type: "Sedan",
      slot: "4hr",
      rate: 1400,
      extra_per_hour: 300,
      extra_per_km: 20,
    },
  ],
};

const mockVehiclePricing = {
  "tn-09-ab-1234": [
    {
      pricing_id: "SUV-4hr",
      cab_type: "SUV",
      slot: "4hr",
      rate: 1300,
      extra_per_hour: 220,
      extra_per_km: 15,
    },
    {
      pricing_id: "SUV-8hr",
      cab_type: "SUV",
      slot: "8hr",
      rate: 2200,
      extra_per_hour: 260,
      extra_per_km: 18,
    },
  ],
};

const mockVehicles = [
  {
    vehicle_id: "tn-09-ab-1234",
    vehicle_number: "TN 09 AB 1234",
    cab_type: "SUV",
    capacity: 6,
    active: true,
    status: "active",
    driver_name: "Arun",
    driver_phone: "+91 90000 01001",
    notes: "Airport rotation",
  },
  {
    vehicle_id: "tn-10-cd-5678",
    vehicle_number: "TN 10 CD 5678",
    cab_type: "Sedan",
    capacity: 4,
    active: true,
    status: "active",
    driver_name: "Suresh",
    driver_phone: "+91 90000 01002",
    notes: "",
  },
];

const mockPayments = [
  {
    payment_id: "pay-001",
    transaction_type: "driver_payment",
    payment_date: "2026-02-10",
    payment_month: "2026-02",
    vehicle_number: "TN 09 AB 1234",
    driver_name: "Arun",
    driver_phone: "+919000001001",
    amount: 18000,
    payment_mode: "bank_transfer",
    status: "paid",
    notes: "February payout",
  },
];

const ALLOWED_SLOTS = new Set(["4hr", "8hr"]);
const BOOKING_REQUEST_STATUS_CATALOG = [
  {
    status: "submitted",
    detail: "Request received and waiting for operations acceptance.",
  },
  {
    status: "accepted",
    detail: "Request accepted by operations and under processing.",
  },
  {
    status: "rejected",
    detail: "Request was reviewed but cannot be fulfilled.",
  },
  {
    status: "cancelled",
    detail: "Request was cancelled by the requester.",
  },
  {
    status: "allotted",
    detail: "Request approved and cab has been allotted.",
  },
];

function assertValidSlot(slot) {
  if (!slot) {
    throw new Error("slot is required");
  }
  if (!ALLOWED_SLOTS.has(slot)) {
    throw new Error("slot must be either 4hr or 8hr");
  }
}

function assertValidBookingRequestStatus(status) {
  if (!status) {
    throw new Error("status is required");
  }
  const validStatuses = BOOKING_REQUEST_STATUS_CATALOG.map((item) => item.status);
  if (!validStatuses.includes(status)) {
    throw new Error(
      `status must be one of ${validStatuses.join(", ")}`
    );
  }
}

function getBookingRequestStatusDetail(status) {
  if (!status) return "";
  const match = BOOKING_REQUEST_STATUS_CATALOG.find(
    (item) => item.status === status
  );
  return match?.detail || "";
}

function normalizeBookingRequest(data = {}, requestId = "") {
  const status = String(data.status || "").trim();
  const normalizedEntryDate = String(data.entry_date || "").trim();
  return {
    ...data,
    entry_date: normalizedEntryDate,
    ...(requestId ? { booking_id: requestId } : {}),
    status_detail: getBookingRequestStatusDetail(status),
  };
}

function getNextMonth(month = "") {
  const [yearRaw, monthRaw] = String(month || "").split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw);
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex)) {
    return "";
  }
  if (monthIndex < 1 || monthIndex > 12) {
    return "";
  }
  const nextYear = monthIndex === 12 ? year + 1 : year;
  const nextMonth = monthIndex === 12 ? 1 : monthIndex + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

function normalizeVehicle(vehicle = {}, vehicleId = "") {
  const isActive =
    typeof vehicle.active === "boolean"
      ? vehicle.active
      : vehicle.status !== "inactive";

  return {
    ...vehicle,
    vehicle_id: vehicle.vehicle_id || vehicleId,
    ownership_type: vehicle.ownership_type || "own",
    active: isActive,
    status: isActive ? "active" : "inactive",
  };
}

function normalizePayment(payment = {}, paymentId = "") {
  const paymentDate = payment.payment_date || "";
  const paymentMonth = payment.payment_month || paymentDate.slice(0, 7) || "";
  const transactionType = payment.transaction_type || "driver_payment";

  return {
    ...payment,
    payment_id: payment.payment_id || paymentId,
    transaction_type: transactionType,
    payment_date: paymentDate,
    payment_month: paymentMonth,
    amount: Number(payment.amount) || 0,
    fuel_liters: Number(payment.fuel_liters) || 0,
    fuel_odometer: Number(payment.fuel_odometer) || 0,
    fuel_station: payment.fuel_station || "",
    status: payment.status || "paid",
    payment_mode: payment.payment_mode || "upi",
  };
}

function getEntryMonth(entryDate = "") {
  return String(entryDate || "").slice(0, 7);
}

function maybeAddEntryMonth(data = {}) {
  const entryMonth = data.entry_month || getEntryMonth(data.entry_date);
  return entryMonth ? { ...data, entry_month: entryMonth } : { ...data };
}

export async function fetchEntries({
  company = "",
  companyId = "",
  vehicle = "",
  vehicleId = "",
  month = "",
  billed,
  orderByField = "",
  orderByDirection = "asc",
  limitCount = 0,
  lastDoc = null,
} = {}) {
  if (!isFirebaseConfigured || !db) {
    return mockEntries.filter((entry) => {
      const matchesCompany =
        companyId ? entry.company_id === companyId : company ? entry.company_name === company : true;
      const matchesVehicle =
        vehicleId ? entry.vehicle_id === vehicleId : vehicle ? entry.vehicle_number === vehicle : true;
      const matchesMonth = month ? entry.entry_month === month : true;
      const matchesBilled =
        typeof billed === "boolean" ? Boolean(entry.billed) === billed : true;
      return matchesCompany && matchesVehicle && matchesMonth && matchesBilled;
    });
  }

  const constraints = [];

  if (companyId) {
    constraints.push(where("company_id", "==", companyId));
  } else if (company) {
    constraints.push(where("company_name", "==", company));
  }

  if (vehicleId) {
    constraints.push(where("vehicle_id", "==", vehicleId));
  } else if (vehicle) {
    constraints.push(where("vehicle_number", "==", vehicle));
  }

  if (month) {
    constraints.push(where("entry_month", "==", month));
  }

  if (typeof billed === "boolean") {
    constraints.push(where("billed", "==", billed));
  }

  if (orderByField) {
    constraints.push(orderBy(orderByField, orderByDirection));
  }

  if (limitCount > 0) {
    constraints.push(limit(limitCount));
  }

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const entriesRef = collection(db, "entries");
  const entriesQuery = constraints.length
    ? query(entriesRef, ...constraints)
    : entriesRef;

  const snapshot = await getDocs(entriesQuery);
  return snapshot.docs.map((docSnap) => ({
    entry_id: docSnap.id,
    ...maybeAddEntryMonth(docSnap.data()),
  }));
}

export async function fetchEntryById(entryId) {
  if (!entryId) {
    throw new Error("entryId is required");
  }

  if (!isFirebaseConfigured || !db) {
    const mockEntry = mockEntries.find((entry) => entry.entry_id === entryId);
    if (!mockEntry) {
      throw new Error("Entry not found");
    }
    return mockEntry;
  }

  const entryRef = doc(db, "entries", entryId);
  const docSnap = await getDoc(entryRef);

  if (!docSnap.exists()) {
    throw new Error("Entry not found");
  }

  return {
    entry_id: docSnap.id,
    ...maybeAddEntryMonth(docSnap.data()),
  };
}

export async function createEntry(payload) {
  assertValidSlot(payload?.slot);

  if (!isFirebaseConfigured || !db) {
    return { ok: true, entry_id: "ENT-NEW" };
  }

  const docRef = doc(collection(db, "entries"));
  const normalizedPayload = maybeAddEntryMonth(payload);
  const entry = {
    ...normalizedPayload,
    entry_id: docRef.id,
    billed: normalizedPayload.billed === true,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  await setDoc(docRef, entry);
  return { entry_id: docRef.id };
}

export async function updateEntry(entryId, payload) {
  if (!entryId) {
    throw new Error("entryId is required");
  }

  if (!isFirebaseConfigured || !db) {
    return { ok: true, entry_id: entryId };
  }

  if (Object.prototype.hasOwnProperty.call(payload || {}, "slot")) {
    assertValidSlot(payload.slot);
  }

  const entryRef = doc(db, "entries", entryId);
  const existingEntrySnap = await getDoc(entryRef);
  const existingEntry = existingEntrySnap.exists() ? existingEntrySnap.data() : {};
  await updateDoc(entryRef, {
    ...maybeAddEntryMonth(payload),
    updated_at: serverTimestamp(),
  });

  const linkedRequestId = String(
    payload?.booking_request_id || existingEntry?.booking_request_id || ""
  ).trim();
  const hasVehicleInPayload = Object.prototype.hasOwnProperty.call(
    payload || {},
    "vehicle_id"
  );
  const resolvedVehicleId = String(
    hasVehicleInPayload ? payload?.vehicle_id || "" : existingEntry?.vehicle_id || ""
  ).trim();

  if (linkedRequestId && resolvedVehicleId) {
    await updateBookingRequest(linkedRequestId, {
      status: "allotted",
      converted_entry_id: entryId,
    });
  }

  return { entry_id: entryId };
}

export async function deleteEntry(entryId) {
  if (!entryId) {
    throw new Error("entryId is required");
  }

  if (!isFirebaseConfigured || !db) {
    return { ok: true, entry_id: entryId };
  }

  const entryRef = doc(db, "entries", entryId);
  await deleteDoc(entryRef);
  return { entry_id: entryId };
}

export async function fetchBookingRequests({
  companyId = "",
  status = "",
  month = "",
  orderByField = "created_at",
  orderByDirection = "desc",
  limitCount = 0,
  lastDoc = null,
} = {}) {
  if (status) {
    assertValidBookingRequestStatus(status);
  }

  if (!isFirebaseConfigured || !db) {
    return [];
  }

  const bookingRequestsRef = collection(db, "booking_requests");
  const constraints = [];
  if (companyId) {
    constraints.push(where("company_id", "==", companyId));
  }
  if (status) {
    constraints.push(where("status", "==", status));
  }
  if (month) {
    const nextMonth = getNextMonth(month);
    if (nextMonth) {
      constraints.push(where("entry_date", ">=", `${month}-01`));
      constraints.push(where("entry_date", "<", `${nextMonth}-01`));
    }
  }
  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }
  const snapshot = await getDocs(
    constraints.length ? query(bookingRequestsRef, ...constraints) : bookingRequestsRef
  );
  const requestDocs = snapshot.docs;

  let filteredRequests = requestDocs.map((docSnap) =>
    normalizeBookingRequest(docSnap.data(), docSnap.id)
  );

  const direction = String(orderByDirection || "desc").toLowerCase() === "asc" ? 1 : -1;
  const field = String(orderByField || "").trim();
  if (field) {
    const toSortable = (value) => {
      if (value === null || value === undefined) return "";
      if (typeof value === "number") return value;
      if (typeof value === "string") return value;
      if (typeof value?.toMillis === "function") return value.toMillis();
      if (typeof value?.seconds === "number") return value.seconds * 1000;
      return String(value);
    };
    filteredRequests = filteredRequests.sort((a, b) => {
      const left = toSortable(a[field]);
      const right = toSortable(b[field]);
      if (left < right) return -1 * direction;
      if (left > right) return 1 * direction;
      return 0;
    });
  }

  if (limitCount > 0) {
    filteredRequests = filteredRequests.slice(0, limitCount);
  }

  return filteredRequests;
}

export async function fetchBookingRequestById(requestId) {
  if (!requestId) {
    throw new Error("requestId is required");
  }

  if (!isFirebaseConfigured || !db) {
    throw new Error("Booking request not found in demo mode");
  }

  const bookingRequestRef = doc(db, "booking_requests", requestId);
  const bookingRequestSnap = await getDoc(bookingRequestRef);

  if (!bookingRequestSnap.exists()) {
    throw new Error("Booking request not found");
  }

  return normalizeBookingRequest(bookingRequestSnap.data(), bookingRequestSnap.id);
}

export async function createBookingRequest(payload = {}) {
  const resolvedStatus = String(payload.status || "submitted").trim();
  const normalizedPayload = {
    company_id: String(payload.company_id || "").trim(),
    company_name: String(payload.company_name || "").trim(),
    entry_date: String(payload.entry_date || "").trim(),
    start_time: String(payload.start_time || "").trim(),
    pickup_location: String(payload.pickup_location || "").trim(),
    drop_location: String(payload.drop_location || "").trim(),
    cab_type: String(payload.cab_type || "").trim(),
    slot: String(payload.slot || "").trim(),
    notes: String(payload.notes || "").trim(),
    status: resolvedStatus,
    created_by: String(payload.created_by || "").trim(),
    approved_by: String(payload.approved_by || "").trim(),
    converted_entry_id: payload.converted_entry_id || null,
  };

  if (!normalizedPayload.company_id) {
    throw new Error("company_id is required");
  }
  if (!normalizedPayload.company_name) {
    throw new Error("company_name is required");
  }
  if (!normalizedPayload.entry_date) {
    throw new Error("entry_date is required");
  }
  if (!normalizedPayload.start_time) {
    throw new Error("start_time is required");
  }
  if (!normalizedPayload.pickup_location) {
    throw new Error("pickup_location is required");
  }
  if (!normalizedPayload.drop_location) {
    throw new Error("drop_location is required");
  }
  if (!normalizedPayload.cab_type) {
    throw new Error("cab_type is required");
  }
  assertValidSlot(normalizedPayload.slot);
  assertValidBookingRequestStatus(normalizedPayload.status);

  if (!isFirebaseConfigured || !db) {
    return { ok: true, booking_id: "REQ-NEW" };
  }

  const docRef = doc(collection(db, "booking_requests"));
  const bookingRequest = {
    ...normalizedPayload,
    booking_id: docRef.id,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  await setDoc(docRef, bookingRequest);
  return { booking_id: docRef.id };
}

export async function updateBookingRequest(requestId, payload = {}) {
  if (!requestId) {
    throw new Error("requestId is required");
  }

  if (Object.prototype.hasOwnProperty.call(payload, "status")) {
    assertValidBookingRequestStatus(payload.status);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "slot")) {
    assertValidSlot(payload.slot);
  }

  const hasConvertedEntryId = Object.prototype.hasOwnProperty.call(
    payload,
    "converted_entry_id"
  );
  const payloadWithoutStatusDetail = { ...payload };
  if (Object.prototype.hasOwnProperty.call(payloadWithoutStatusDetail, "status_detail")) {
    delete payloadWithoutStatusDetail.status_detail;
  }

  if (!isFirebaseConfigured || !db) {
    return { ok: true, booking_id: requestId };
  }

  const bookingRequestRef = doc(db, "booking_requests", requestId);
  await setDoc(
    bookingRequestRef,
    {
      ...payloadWithoutStatusDetail,
      status_detail: deleteField(),
      ...(hasConvertedEntryId
        ? { converted_entry_id: payload.converted_entry_id || null }
        : {}),
      updated_at: serverTimestamp(),
    },
    { merge: true }
  );
  return { booking_id: requestId };
}

export async function deleteBookingRequest(requestId) {
  if (!requestId) {
    throw new Error("requestId is required");
  }

  if (!isFirebaseConfigured || !db) {
    return { ok: true, booking_id: requestId };
  }

  const bookingRequestRef = doc(db, "booking_requests", requestId);
  await deleteDoc(bookingRequestRef);
  return { booking_id: requestId };
}

export async function acceptBookingRequest(requestId, reviewedBy = "") {
  if (!requestId) {
    throw new Error("requestId is required");
  }

  if (!isFirebaseConfigured || !db) {
    return { ok: true, booking_id: requestId, entry_id: "ENT-NEW" };
  }

  const bookingRequestRef = doc(db, "booking_requests", requestId);
  const bookingRequestSnap = await getDoc(bookingRequestRef);
  if (!bookingRequestSnap.exists()) {
    throw new Error("Booking request not found");
  }

  const requestData = bookingRequestSnap.data() || {};
  const requestStatus = String(requestData.status || "").trim();

  if (requestStatus === "rejected" || requestStatus === "cancelled") {
    throw new Error(`Cannot accept a ${requestStatus} request.`);
  }
  if (requestStatus === "allotted") {
    throw new Error("Request is already allotted.");
  }

  const existingEntryId = String(requestData.converted_entry_id || "").trim();
  let entryId = existingEntryId;

  if (!entryId) {
    const entryResult = await createEntry({
      entry_date: requestData.entry_date || "",
      company_id: requestData.company_id || "",
      company_name: requestData.company_name || "",
      slot: requestData.slot || "",
      start_time: requestData.start_time || "",
      end_time: "",
      pickup_location: requestData.pickup_location || "",
      drop_location: requestData.drop_location || "",
      vehicle_id: "",
      vehicle_number: "",
      cab_type: requestData.cab_type || "",
      user_name: requestData.created_by || "",
      notes: requestData.notes || "",
      rate: 0,
      tolls: 0,
      total: 0,
      billed: false,
      booking_request_id: requestId,
      booking_request_status: "accepted",
    });
    entryId = entryResult.entry_id;
  }

  await updateBookingRequest(requestId, {
    status: "accepted",
    approved_by: String(reviewedBy || "").trim(),
    converted_entry_id: entryId || null,
  });

  return { booking_id: requestId, entry_id: entryId };
}

export async function rejectBookingRequest(requestId, reviewedBy = "") {
  if (!requestId) {
    throw new Error("requestId is required");
  }

  if (!isFirebaseConfigured || !db) {
    return { ok: true, booking_id: requestId };
  }

  const bookingRequestRef = doc(db, "booking_requests", requestId);
  const bookingRequestSnap = await getDoc(bookingRequestRef);
  if (!bookingRequestSnap.exists()) {
    throw new Error("Booking request not found");
  }

  const requestData = bookingRequestSnap.data() || {};
  const requestStatus = String(requestData.status || "").trim();
  if (requestStatus === "allotted") {
    throw new Error("Allotted requests cannot be rejected.");
  }
  if (requestStatus === "rejected") {
    return { booking_id: requestId };
  }

  await updateBookingRequest(requestId, {
    status: "rejected",
    approved_by: String(reviewedBy || "").trim(),
  });

  return { booking_id: requestId };
}

export function getBookingRequestStatusCatalog() {
  return BOOKING_REQUEST_STATUS_CATALOG.map((item) => ({ ...item }));
}

export async function fetchCompanies() {
  if (!isFirebaseConfigured || !db) {
    return mockCompanies;
  }

  const companiesRef = collection(db, "companies");
  const snapshot = await getDocs(companiesRef);
  return snapshot.docs.map((docSnap) => ({
    company_id: docSnap.id,
    ...docSnap.data(),
  }));
}

export async function createCompany(payload) {
  if (!isFirebaseConfigured || !db) {
    return { ok: true, company_id: "company-new" };
  }

  const docRef = doc(collection(db, "companies"));
  const company = {
    ...payload,
    company_id: docRef.id,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  await setDoc(docRef, company);
  return { company_id: docRef.id };
}

export async function updateCompany(companyId, payload) {
  if (!companyId) {
    throw new Error("companyId is required");
  }

  if (!isFirebaseConfigured || !db) {
    return { ok: true, company_id: companyId };
  }

  const docRef = doc(db, "companies", companyId);
  const company = {
    ...payload,
    company_id: companyId,
    updated_at: serverTimestamp(),
  };

  await setDoc(docRef, company, { merge: true });
  return { company_id: companyId };
}

export async function fetchPricing(companyId) {
  if (!companyId) {
    throw new Error("companyId is required");
  }

  if (!isFirebaseConfigured || !db) {
    return mockPricing[companyId] || [];
  }

  const pricingRef = collection(db, "companies", companyId, "pricing");
  const snapshot = await getDocs(pricingRef);
  return snapshot.docs.map((docSnap) => ({
    pricing_id: docSnap.id,
    ...docSnap.data(),
  }));
}

export async function createPricing(companyId, payload) {
  if (!companyId) {
    throw new Error("companyId is required");
  }

  if (!payload?.cab_type || !payload?.slot) {
    throw new Error("cab_type and slot are required");
  }
  assertValidSlot(payload.slot);

  if (!isFirebaseConfigured || !db) {
    return { ok: true, pricing_id: "pricing-new" };
  }

  const pricingId = `${payload.cab_type}-${payload.slot}`;
  const docRef = doc(collection(db, "companies", companyId, "pricing"), pricingId);
  const pricing = {
    ...payload,
    rate: Number(payload.rate) || 0,
    extra_per_hour: Number(payload.extra_per_hour) || 0,
    extra_per_km: Number(payload.extra_per_km) || 0,
    pricing_id: pricingId,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  await setDoc(docRef, pricing);
  return { pricing_id: docRef.id };
}

export async function updatePricing(companyId, pricingId, payload) {
  if (!companyId || !pricingId) {
    throw new Error("companyId and pricingId are required");
  }

  if (!isFirebaseConfigured || !db) {
    return { ok: true, pricing_id: pricingId };
  }

  if (Object.prototype.hasOwnProperty.call(payload || {}, "slot")) {
    assertValidSlot(payload.slot);
  }

  const docRef = doc(collection(db, "companies", companyId, "pricing"), pricingId);
  const pricing = {
    ...payload,
    rate: Number(payload.rate) || 0,
    extra_per_hour: Number(payload.extra_per_hour) || 0,
    extra_per_km: Number(payload.extra_per_km) || 0,
    pricing_id: pricingId,
    updated_at: serverTimestamp(),
  };

  await setDoc(docRef, pricing, { merge: true });
  return { pricing_id: pricingId };
}

export async function deletePricing(companyId, pricingId) {
  if (!companyId || !pricingId) {
    throw new Error("companyId and pricingId are required");
  }

  if (!isFirebaseConfigured || !db) {
    return { ok: true, pricing_id: pricingId };
  }

  const docRef = doc(collection(db, "companies", companyId, "pricing"), pricingId);
  await deleteDoc(docRef);
  return { pricing_id: pricingId };
}

export async function fetchVehicles() {
  if (!isFirebaseConfigured || !db) {
    return mockVehicles.map((vehicle) => normalizeVehicle(vehicle));
  }

  const vehiclesRef = collection(db, "vehicles");
  const snapshot = await getDocs(vehiclesRef);
  return snapshot.docs.map((docSnap) =>
    normalizeVehicle(docSnap.data(), docSnap.id)
  );
}

export async function fetchVehiclePricing(vehicleId) {
  if (!vehicleId) {
    throw new Error("vehicleId is required");
  }

  if (!isFirebaseConfigured || !db) {
    return mockVehiclePricing[vehicleId] || [];
  }

  const pricingRef = collection(db, "vehicles", vehicleId, "pricing");
  const snapshot = await getDocs(pricingRef);
  return snapshot.docs.map((docSnap) => ({
    pricing_id: docSnap.id,
    ...docSnap.data(),
  }));
}

export async function createVehiclePricing(vehicleId, payload) {
  if (!vehicleId) {
    throw new Error("vehicleId is required");
  }

  if (!payload?.cab_type || !payload?.slot) {
    throw new Error("cab_type and slot are required");
  }
  assertValidSlot(payload.slot);

  if (!isFirebaseConfigured || !db) {
    return { ok: true, pricing_id: `${payload.cab_type}-${payload.slot}` };
  }

  const pricingId = `${payload.cab_type}-${payload.slot}`;
  const docRef = doc(collection(db, "vehicles", vehicleId, "pricing"), pricingId);
  const pricing = {
    ...payload,
    rate: Number(payload.rate) || 0,
    extra_per_hour: Number(payload.extra_per_hour) || 0,
    extra_per_km: Number(payload.extra_per_km) || 0,
    pricing_id: pricingId,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  await setDoc(docRef, pricing);
  return { pricing_id: docRef.id };
}

export async function updateVehiclePricing(vehicleId, pricingId, payload) {
  if (!vehicleId || !pricingId) {
    throw new Error("vehicleId and pricingId are required");
  }

  if (!isFirebaseConfigured || !db) {
    return { ok: true, pricing_id: pricingId };
  }

  if (Object.prototype.hasOwnProperty.call(payload || {}, "slot")) {
    assertValidSlot(payload.slot);
  }

  const docRef = doc(collection(db, "vehicles", vehicleId, "pricing"), pricingId);
  const pricing = {
    ...payload,
    rate: Number(payload.rate) || 0,
    extra_per_hour: Number(payload.extra_per_hour) || 0,
    extra_per_km: Number(payload.extra_per_km) || 0,
    pricing_id: pricingId,
    updated_at: serverTimestamp(),
  };

  await setDoc(docRef, pricing, { merge: true });
  return { pricing_id: pricingId };
}

export async function deleteVehiclePricing(vehicleId, pricingId) {
  if (!vehicleId || !pricingId) {
    throw new Error("vehicleId and pricingId are required");
  }

  if (!isFirebaseConfigured || !db) {
    return { ok: true, pricing_id: pricingId };
  }

  const docRef = doc(collection(db, "vehicles", vehicleId, "pricing"), pricingId);
  await deleteDoc(docRef);
  return { pricing_id: pricingId };
}

export async function countActiveCompanies() {
  if (!isFirebaseConfigured || !db) {
    return mockCompanies.filter((c) => c.active !== false).length;
  }

  const companiesRef = collection(db, "companies");
  const [totalSnapshot, inactiveSnapshot] = await Promise.all([
    getCountFromServer(companiesRef),
    getCountFromServer(query(companiesRef, where("active", "==", false))),
  ]);
  return totalSnapshot.data().count - inactiveSnapshot.data().count;
}

export async function countActiveVehicles() {
  if (!isFirebaseConfigured || !db) {
    return mockVehicles.filter((v) => normalizeVehicle(v).active).length;
  }

  const vehiclesRef = collection(db, "vehicles");
  const snapshot = await getCountFromServer(
    query(vehiclesRef, where("active", "==", true))
  );
  return snapshot.data().count;
}

export async function countUsers() {
  if (!isFirebaseConfigured || !db) {
    return 0;
  }

  const usersRef = collection(db, "users");
  const snapshot = await getCountFromServer(usersRef);
  return snapshot.data().count;
}

export async function countInvoices() {
  if (!isFirebaseConfigured || !db) {
    return 0;
  }

  const invoicesRef = collection(db, "invoices");
  const snapshot = await getCountFromServer(invoicesRef);
  return snapshot.data().count;
}

export async function countEntriesByMonth(month = "") {
  if (!isFirebaseConfigured || !db) {
    if (!month) return mockEntries.length;
    const start = `${month}-01`;
    const end = `${month}-31`;
    return mockEntries.filter(
      (e) => e.entry_date >= start && e.entry_date <= end
    ).length;
  }

  const entriesRef = collection(db, "entries");
  const constraints = [];

  if (month) {
    constraints.push(where("entry_month", "==", month));
  }

  const countQuery = constraints.length
    ? query(entriesRef, ...constraints)
    : entriesRef;
  const snapshot = await getCountFromServer(countQuery);
  return snapshot.data().count;
}

export async function createVehicle(payload) {
  if (!isFirebaseConfigured || !db) {
    return { ok: true, vehicle_id: "vehicle-new" };
  }

  const docRef = doc(collection(db, "vehicles"));
  const active =
    typeof payload?.active === "boolean"
      ? payload.active
      : payload?.status !== "inactive";
  const vehicle = {
    ...payload,
    active,
    status: active ? "active" : "inactive",
    vehicle_id: docRef.id,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  await setDoc(docRef, vehicle);
  return { vehicle_id: docRef.id };
}

export async function updateVehicle(vehicleId, payload) {
  if (!vehicleId) {
    throw new Error("vehicleId is required");
  }

  if (!isFirebaseConfigured || !db) {
    return { ok: true, vehicle_id: vehicleId };
  }

  const active =
    typeof payload?.active === "boolean"
      ? payload.active
      : payload?.status !== "inactive";
  const vehicleRef = doc(db, "vehicles", vehicleId);
  await updateDoc(vehicleRef, {
    ...payload,
    active,
    status: active ? "active" : "inactive",
    updated_at: serverTimestamp(),
  });
  return { vehicle_id: vehicleId };
}

export async function fetchPayments({
  month = "",
  vehicleId = "",
  vehicle = "",
  transactionType = "",
  status = "",
  limitCount = 0,
  lastDoc = null,
} = {}) {
  if (!isFirebaseConfigured || !db) {
    const filtered = mockPayments
      .map((payment) => normalizePayment(payment))
      .filter((payment) => (month ? payment.payment_month === month : true))
      .filter((payment) => (vehicleId ? payment.vehicle_id === vehicleId : true))
      .filter((payment) => (vehicle ? payment.vehicle_number === vehicle : true))
      .filter((payment) =>
        transactionType
          ? String(payment.transaction_type || "driver_payment") === transactionType
          : true
      )
      .filter((payment) =>
        status ? String(payment.status || "").toLowerCase() === String(status).toLowerCase() : true
      );

    return filtered.sort((a, b) =>
      String(b.payment_date).localeCompare(String(a.payment_date))
    );
  }

  const paymentsRef = collection(db, "payments");
  const constraints = [];

  if (month) {
    constraints.push(where("payment_month", "==", month));
  }
  if (vehicleId) {
    constraints.push(where("vehicle_id", "==", vehicleId));
  } else if (vehicle) {
    constraints.push(where("vehicle_number", "==", vehicle));
  }
  if (transactionType) {
    constraints.push(where("transaction_type", "==", transactionType));
  }
  if (status) {
    constraints.push(where("status", "==", status));
  }

  constraints.push(orderBy("payment_date", "desc"));

  if (limitCount > 0) {
    constraints.push(limit(limitCount));
  }
  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const paymentsQuery = query(paymentsRef, ...constraints);
  const snapshot = await getDocs(paymentsQuery);

  return snapshot.docs.map((docSnap) => normalizePayment(docSnap.data(), docSnap.id));
}

export async function createPayment(payload) {
  if (!isFirebaseConfigured || !db) {
    return { ok: true, payment_id: "payment-new" };
  }

  const docRef = doc(collection(db, "payments"));
  const payment = normalizePayment(
    {
      ...payload,
      payment_id: docRef.id,
      payment_month:
        payload?.payment_month || String(payload?.payment_date || "").slice(0, 7),
    },
    docRef.id
  );

  await setDoc(docRef, {
    ...payment,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return { payment_id: docRef.id };
}

export async function updatePayment(paymentId, payload) {
  if (!paymentId) {
    throw new Error("paymentId is required");
  }

  if (!isFirebaseConfigured || !db) {
    return { ok: true, payment_id: paymentId };
  }

  const payment = normalizePayment(
    {
      ...payload,
      payment_id: paymentId,
      payment_month:
        payload?.payment_month || String(payload?.payment_date || "").slice(0, 7),
    },
    paymentId
  );

  const paymentRef = doc(db, "payments", paymentId);
  await updateDoc(paymentRef, {
    ...payment,
    updated_at: serverTimestamp(),
  });
  return { payment_id: paymentId };
}

export async function deletePayment(paymentId) {
  if (!paymentId) {
    throw new Error("paymentId is required");
  }

  if (!isFirebaseConfigured || !db) {
    return { ok: true, payment_id: paymentId };
  }

  const paymentRef = doc(db, "payments", paymentId);
  await deleteDoc(paymentRef);
  return { payment_id: paymentId };
}

export async function invoiceExists(companyId, month) {
  if (!companyId || !month) {
    return false;
  }

  if (!isFirebaseConfigured || !db) {
    return false;
  }

  const invoiceId = `${companyId}-${month}`;
  const invoiceRef = doc(db, "invoices", invoiceId);
  const invoiceSnap = await getDoc(invoiceRef);
  if (!invoiceSnap.exists()) {
    return false;
  }
  return String(invoiceSnap.data().status || "draft").toLowerCase() !== "draft";
}

export async function generateInvoice(companyId, month) {
  if (!companyId || !month) {
    throw new Error("companyId and month are required");
  }

  if (!isFirebaseConfigured || !db) {
    return {
      ok: true,
      invoice_id: `INV-${month}-${companyId}`,
    };
  }

  // Check if invoice already exists
  const invoiceId = `${companyId}-${month}`;
  const invoiceRef = doc(db, "invoices", invoiceId);
  const invoiceSnap = await getDoc(invoiceRef);
  const existingInvoiceStatus = invoiceSnap.exists()
    ? String(invoiceSnap.data().status || "draft").toLowerCase()
    : "";
  if (invoiceSnap.exists() && existingInvoiceStatus !== "draft") {
    throw new Error(
      `Invoice already exists for this company and month. Current status: ${invoiceSnap.data().status || "draft"}`
    );
  }

  // Fetch company to get its name and details
  const companyRef = doc(db, "companies", companyId);
  const companySnap = await getDoc(companyRef);
  const companyData = companySnap.exists() ? companySnap.data() : {};
  const companyName = companyData.name || companyId;
  const companyAddress = companyData.address || "";
  const companyPhone = companyData.phone || "";
  const companyEmail = companyData.email || "";
  const bankDetails = companyData.bank_details || "";

  // Fetch entries for the month by company ID.
  const entriesRef = collection(db, "entries");

  // Regenerating a draft invoice: release currently linked entries first.
  if (invoiceSnap.exists() && existingInvoiceStatus === "draft") {
    const linkedEntriesSnapshot = await getDocs(
      query(entriesRef, where("invoice_id", "==", invoiceId))
    );

    const batchSize = 450;
    for (let i = 0; i < linkedEntriesSnapshot.docs.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = linkedEntriesSnapshot.docs.slice(i, i + batchSize);
      for (const entryDoc of chunk) {
        batch.update(entryDoc.ref, {
          billed: false,
          invoice_id: deleteField(),
          updated_at: serverTimestamp(),
        });
      }
      await batch.commit();
    }
  }

  let entriesQuery = query(
    entriesRef,
    where("company_id", "==", companyId),
    where("entry_month", "==", month),
    where("billed", "==", false)
  );
  const entriesSnapshot = await getDocs(entriesQuery);

  const entries = entriesSnapshot.docs.map((doc) => ({
    entry_id: doc.id,
    ...doc.data(),
  }));

  // Calculate total
  let subtotalAmount = 0;
  const lineItems = entries
    .filter((entry) => (Number(entry.total) || Number(entry.rate) || 0) > 0)
    .map((entry) => {
      const rate = Number(entry.rate) || 0;
      const extraHours = Number(entry.hours) || 0;
      const extraKms = Number(entry.kms) || 0;
      const tolls = Number(entry.tolls) || 0;
      const amount = Number(entry.total) || rate;
      subtotalAmount += amount;
      return {
        entry_id: entry.entry_id,
        cab_type: entry.cab_type || "Unknown",
        slot: entry.slot || "Unknown",
        rate,
        extra_hours: extraHours,
        extra_kms: extraKms,
        tolls,
        amount,
        date: entry.entry_date || "",
        vehicle_number: entry.vehicle_number || "",
      };
    });

  // Create invoice
  const taxAmount = Math.round(subtotalAmount * 0.18);
  const now = new Date();
  const invoiceDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const invoice = {
    invoice_id: invoiceId,
    invoice_type: "company",
    company_id: companyId,
    company_name: companyName,
    company_address: companyAddress,
    company_phone: companyPhone,
    company_email: companyEmail,
    bank_details: bankDetails,
    period: month,
    invoice_date: invoiceDate,
    entries_count: lineItems.length,
    line_items: lineItems,
    subtotal: Math.round(subtotalAmount),
    tax: taxAmount,
    total: Math.round(subtotalAmount) + taxAmount,
    status: "draft",
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  await setDoc(invoiceRef, invoice);

  // Mark all entries used in this invoice as billed
  const batchSize = 450;
  for (let i = 0; i < lineItems.length; i += batchSize) {
    const batch = writeBatch(db);
    const chunk = lineItems.slice(i, i + batchSize);
    for (const lineItem of chunk) {
      const entryRef = doc(db, "entries", lineItem.entry_id);
      batch.update(entryRef, {
        invoice_id: invoiceId,
        billed: true,
        updated_at: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  return { invoice_id: invoiceId };
}

export async function vehicleInvoiceExists(vehicleId, month) {
  if (!vehicleId || !month) {
    return false;
  }

  if (!isFirebaseConfigured || !db) {
    return false;
  }

  const invoiceId = `${vehicleId}-${month}`;
  const invoiceRef = doc(db, "invoices", invoiceId);
  const invoiceSnap = await getDoc(invoiceRef);
  if (!invoiceSnap.exists()) {
    return false;
  }
  return String(invoiceSnap.data().status || "draft").toLowerCase() !== "draft";
}

export async function generateVehicleInvoice(vehicleId, month) {
  if (!vehicleId || !month) {
    throw new Error("vehicleId and month are required");
  }

  if (!isFirebaseConfigured || !db) {
    return {
      ok: true,
      invoice_id: `${vehicleId}-${month}`,
    };
  }

  const vehicleRef = doc(db, "vehicles", vehicleId);
  const vehicleSnap = await getDoc(vehicleRef);
  if (!vehicleSnap.exists()) {
    throw new Error("Vehicle not found");
  }

  const vehicleData = normalizeVehicle(vehicleSnap.data(), vehicleSnap.id);
  if (vehicleData.ownership_type !== "leased") {
    throw new Error("Vehicle invoice can only be generated for leased vehicles");
  }

  const invoiceId = `${vehicleId}-${month}`;
  const invoiceRef = doc(db, "invoices", invoiceId);
  const invoiceSnap = await getDoc(invoiceRef);
  if (
    invoiceSnap.exists() &&
    String(invoiceSnap.data().status || "draft").toLowerCase() !== "draft"
  ) {
    throw new Error(
      `Invoice already exists for this vehicle and month. Current status: ${invoiceSnap.data().status || "draft"}`
    );
  }

  const entriesRef = collection(db, "entries");
  let entriesQuery = query(
    entriesRef,
    where("vehicle_id", "==", vehicleId),
    where("entry_month", "==", month),
    where("billed", "==", false)
  );
  const entriesSnapshot = await getDocs(entriesQuery);

  const entries = entriesSnapshot.docs.map((docSnap) => ({
    entry_id: docSnap.id,
    ...docSnap.data(),
  }));

  const vehiclePricing = await fetchVehiclePricing(vehicleId);
  const pricingBySlot = new Map(
    vehiclePricing
      .filter((price) => price.cab_type === vehicleData.cab_type)
      .map((price) => [price.slot, price])
  );

  const lineItems = entries.map((entry) => {
    const priceConfig = pricingBySlot.get(entry.slot) || {};
    const rate = Number(priceConfig.rate) || 0;
    const billing = computeEntryBilling({
      slot: entry.slot,
      rate,
      extra_per_hour: Number(priceConfig.extra_per_hour) || 0,
      extra_per_km: Number(priceConfig.extra_per_km) || 0,
      tolls: Number(entry.tolls) || 0,
      start_time: entry.start_time,
      end_time: entry.end_time,
      odometer_start: entry.odometer_start,
      odometer_end: entry.odometer_end,
    });

    return {
      entry_id: entry.entry_id,
      date: entry.entry_date || "",
      company_name: entry.company_name || "",
      slot: entry.slot || "",
      cab_type: vehicleData.cab_type || entry.cab_type || "",
      vehicle_number: vehicleData.vehicle_number || entry.vehicle_number || "",
      rate: billing.rate,
      extra_hours: billing.extraHours,
      extra_kms: billing.extraKms,
      tolls: billing.tolls,
      amount: billing.total,
    };
  });

  const missingPricingSlots = Array.from(
    new Set(
      entries
        .filter((entry) => !pricingBySlot.has(entry.slot))
        .map((entry) => entry.slot || "unknown")
    )
  );

  if (missingPricingSlots.length > 0) {
    throw new Error(
      `Vehicle pricing missing for slot(s): ${missingPricingSlots.join(", ")}`
    );
  }

  const subtotal = Math.round(
    lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  );
  const taxAmount = 0;
  const now = new Date();
  const invoiceDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const invoice = {
    invoice_id: invoiceId,
    invoice_type: "vehicle",
    vehicle_id: vehicleId,
    vehicle_number: vehicleData.vehicle_number || "",
    driver_name: vehicleData.driver_name || "",
    driver_phone: vehicleData.driver_phone || "",
    period: month,
    invoice_date: invoiceDate,
    entries_count: lineItems.length,
    line_items: lineItems,
    subtotal,
    tax: taxAmount,
    total: subtotal + taxAmount,
    status: "draft",
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  await setDoc(invoiceRef, invoice);

  return { invoice_id: invoiceId };
}

export async function fetchInvoices(
  companyId,
  { limitCount = 0, lastDoc = null } = {}
) {
  if (!companyId) {
    throw new Error("companyId is required");
  }

  if (!isFirebaseConfigured || !db) {
    return [];
  }

  const invoicesRef = collection(db, "invoices");
  const constraints = [
    where("company_id", "==", companyId),
    orderBy("period", "desc"),
  ];

  if (limitCount > 0) {
    constraints.push(limit(limitCount));
  }
  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const invoicesQuery = query(invoicesRef, ...constraints);
  const snapshot = await getDocs(invoicesQuery);
  return snapshot.docs.map((docSnap) => ({
    invoice_id: docSnap.id,
    ...docSnap.data(),
  }));
}

export async function fetchInvoicesByPeriod(period, { limitCount = 0, lastDoc = null } = {}) {
  if (!period) {
    throw new Error("period is required");
  }

  if (!isFirebaseConfigured || !db) {
    return [];
  }

  const invoicesRef = collection(db, "invoices");
  const constraints = [
    where("period", "==", period),
    orderBy("invoice_date", "desc"),
  ];

  if (limitCount > 0) {
    constraints.push(limit(limitCount));
  }
  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const invoicesQuery = query(invoicesRef, ...constraints);
  const snapshot = await getDocs(invoicesQuery);

  return snapshot.docs.map((docSnap) => ({
    invoice_id: docSnap.id,
    ...docSnap.data(),
  }));
}

export async function fetchVehicleInvoices(
  vehicleId,
  { limitCount = 0, lastDoc = null } = {}
) {
  if (!vehicleId) {
    throw new Error("vehicleId is required");
  }

  if (!isFirebaseConfigured || !db) {
    return [];
  }

  const invoicesRef = collection(db, "invoices");
  const constraints = [
    where("vehicle_id", "==", vehicleId),
    orderBy("period", "desc"),
  ];

  if (limitCount > 0) {
    constraints.push(limit(limitCount));
  }
  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const invoicesQuery = query(invoicesRef, ...constraints);
  const snapshot = await getDocs(invoicesQuery);
  return snapshot.docs.map((docSnap) => ({
    invoice_id: docSnap.id,
    ...docSnap.data(),
  }));
}

export async function updateInvoiceStatus(invoiceId, status, note = "") {
  if (!invoiceId || !status) {
    throw new Error("invoiceId and status are required");
  }

  if (!isFirebaseConfigured || !db) {
    return { ok: true, invoice_id: invoiceId };
  }

  const invoiceRef = doc(collection(db, "invoices"), invoiceId);
  const updateData = {
    status,
    updated_at: serverTimestamp(),
  };

  if (note) {
    updateData.payment_note = note;
  }

  await setDoc(
    invoiceRef,
    updateData,
    { merge: true }
  );
  return { invoice_id: invoiceId };
}

export { isFirebaseConfigured };
