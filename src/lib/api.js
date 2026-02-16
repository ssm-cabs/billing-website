import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  where,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";

const mockEntries = [
  {
    entry_id: "ENT-2401",
    entry_date: "2026-02-10",
    company_name: "Acme Corp",
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
    company_name: "Globex",
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
    { pricing_id: "p1", cab_type: "SUV", slot: "8hr", rate: 2400 },
    { pricing_id: "p2", cab_type: "Sedan", slot: "4hr", rate: 1200 },
  ],
  globex: [
    { pricing_id: "p3", cab_type: "Sedan", slot: "4hr", rate: 1400 },
  ],
};

const mockVehiclePricing = {
  "tn-09-ab-1234": [
    { pricing_id: "SUV-4hr", cab_type: "SUV", slot: "4hr", rate: 1300 },
    { pricing_id: "SUV-8hr", cab_type: "SUV", slot: "8hr", rate: 2200 },
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

function assertValidSlot(slot) {
  if (!slot) {
    throw new Error("slot is required");
  }
  if (!ALLOWED_SLOTS.has(slot)) {
    throw new Error("slot must be either 4hr or 8hr");
  }
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

export async function fetchEntries({ company = "", month = "", orderByField = "", orderByDirection = "asc", limitCount = 0 } = {}) {
  if (!isFirebaseConfigured || !db) {
    return mockEntries;
  }

  const constraints = [];

  if (company) {
    constraints.push(where("company_name", "==", company));
  }

  if (month) {
    const start = `${month}-01`;
    const end = `${month}-31`;
    constraints.push(where("entry_date", ">=", start));
    constraints.push(where("entry_date", "<=", end));
  }

  if (orderByField) {
    constraints.push(orderBy(orderByField, orderByDirection));
  }

  if (limitCount > 0) {
    constraints.push(limit(limitCount));
  }

  const entriesRef = collection(db, "entries");
  const entriesQuery = constraints.length
    ? query(entriesRef, ...constraints)
    : entriesRef;

  const snapshot = await getDocs(entriesQuery);
  return snapshot.docs.map((docSnap) => ({
    entry_id: docSnap.id,
    ...docSnap.data(),
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
    ...docSnap.data(),
  };
}

export async function createEntry(payload) {
  assertValidSlot(payload?.slot);

  if (!isFirebaseConfigured || !db) {
    return { ok: true, entry_id: "ENT-NEW" };
  }

  const docRef = doc(collection(db, "entries"));
  const entry = {
    ...payload,
    entry_id: docRef.id,
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
  await updateDoc(entryRef, {
    ...payload,
    updated_at: serverTimestamp(),
  });
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
    pricing_id: pricingId,
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
  const snapshot = await getDocs(vehiclesRef);
  return snapshot.docs.filter((docSnap) => normalizeVehicle(docSnap.data()).active)
    .length;
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
    const start = `${month}-01`;
    const end = `${month}-31`;
    constraints.push(where("entry_date", ">=", start));
    constraints.push(where("entry_date", "<=", end));
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
} = {}) {
  if (!isFirebaseConfigured || !db) {
    const filtered = mockPayments
      .map((payment) => normalizePayment(payment))
      .filter((payment) => (month ? payment.payment_month === month : true));

    return filtered.sort((a, b) =>
      String(b.payment_date).localeCompare(String(a.payment_date))
    );
  }

  const paymentsRef = collection(db, "payments");
  const paymentsQuery = month
    ? query(paymentsRef, where("payment_month", "==", month))
    : paymentsRef;
  const snapshot = await getDocs(paymentsQuery);
  const normalized = snapshot.docs.map((docSnap) =>
    normalizePayment(docSnap.data(), docSnap.id)
  );

  return normalized.sort((a, b) =>
    String(b.payment_date).localeCompare(String(a.payment_date))
  );
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
  return invoiceSnap.exists();
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
  if (invoiceSnap.exists()) {
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

  // Fetch entries for the month by company_name
  const start = `${month}-01`;
  const end = `${month}-31`;
  const entriesRef = collection(db, "entries");
  const entriesQuery = query(
    entriesRef,
    where("company_name", "==", companyName),
    where("entry_date", ">=", start),
    where("entry_date", "<=", end)
  );
  const entriesSnapshot = await getDocs(entriesQuery);
  const entries = entriesSnapshot.docs.map((doc) => ({
    entry_id: doc.id,
    ...doc.data(),
  }));

  // Calculate total
  let total = 0;
  const lineItems = entries
    .filter((entry) => entry.rate > 0) // Only include entries with a rate
    .map((entry) => {
      const rate = Number(entry.rate) || 0; // Ensure it's a number
      const amount = rate;
      total += amount; // This will now add as numbers
      return {
        entry_id: entry.entry_id,
        cab_type: entry.cab_type || "Unknown",
        slot: entry.slot || "Unknown",
        rate,
        amount,
        date: entry.entry_date || "",
        vehicle_number: entry.vehicle_number || "",
      };
    });

  // Create invoice
  const taxAmount = Math.round(total * 0.18);
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
    subtotal: Math.round(total),
    tax: taxAmount,
    total: Math.round(total) + taxAmount,
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
  return invoiceSnap.exists();
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
  if (invoiceSnap.exists()) {
    throw new Error(
      `Invoice already exists for this vehicle and month. Current status: ${invoiceSnap.data().status || "draft"}`
    );
  }

  const start = `${month}-01`;
  const end = `${month}-31`;
  const entriesRef = collection(db, "entries");
  const entriesQuery = query(
    entriesRef,
    where("vehicle_number", "==", vehicleData.vehicle_number),
    where("entry_date", ">=", start),
    where("entry_date", "<=", end)
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
      .map((price) => [price.slot, Number(price.rate) || 0])
  );

  const lineItems = entries.map((entry) => {
    const rate = pricingBySlot.get(entry.slot) || 0;
    return {
      entry_id: entry.entry_id,
      date: entry.entry_date || "",
      company_name: entry.company_name || "",
      slot: entry.slot || "",
      cab_type: vehicleData.cab_type || entry.cab_type || "",
      vehicle_number: vehicleData.vehicle_number || entry.vehicle_number || "",
      rate,
      amount: rate,
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

export async function fetchInvoices(companyId) {
  if (!companyId) {
    throw new Error("companyId is required");
  }

  if (!isFirebaseConfigured || !db) {
    return [];
  }

  const invoicesRef = collection(db, "invoices");
  const invoicesQuery = query(
    invoicesRef,
    where("company_id", "==", companyId),
    orderBy("period", "desc")
  );
  const snapshot = await getDocs(invoicesQuery);
  return snapshot.docs.map((docSnap) => ({
    invoice_id: docSnap.id,
    ...docSnap.data(),
  }));
}

export async function fetchVehicleInvoices(vehicleId) {
  if (!vehicleId) {
    throw new Error("vehicleId is required");
  }

  if (!isFirebaseConfigured || !db) {
    return [];
  }

  const invoicesRef = collection(db, "invoices");
  const invoicesQuery = query(
    invoicesRef,
    where("vehicle_id", "==", vehicleId),
    orderBy("period", "desc")
  );
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
