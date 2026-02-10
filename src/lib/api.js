import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getCountFromServer,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";

const mockEntries = [
  {
    entry_id: "ENT-2401",
    entry_date: "2026-02-10",
    company_name: "Acme Corp",
    cab_type: "SUV",
    slot: "6hr",
    pickup_location: "T Nagar",
    drop_location: "Guindy",
    driver_name: "Arun",
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
    driver_name: "Suresh",
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
    active: true,
  },
  {
    company_id: "globex",
    name: "Globex",
    billing_cycle: "monthly",
    contact_name: "Meera",
    contact_phone: "+91 90000 00002",
    address: "Guindy, Chennai",
    active: true,
  },
];

const mockPricing = {
  "acme-corp": [
    { pricing_id: "p1", cab_type: "SUV", slot: "6hr", rate: 2400 },
    { pricing_id: "p2", cab_type: "Sedan", slot: "4hr", rate: 1200 },
  ],
  globex: [
    { pricing_id: "p3", cab_type: "Sedan", slot: "4hr", rate: 1400 },
  ],
};

const mockVehicles = [
  {
    vehicle_id: "tn-09-ab-1234",
    vehicle_number: "TN 09 AB 1234",
    cab_type: "SUV",
    capacity: 6,
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
    status: "active",
    driver_name: "Suresh",
    driver_phone: "+91 90000 01002",
    notes: "",
  },
];

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

export async function createEntry(payload) {
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
    return mockVehicles;
  }

  const vehiclesRef = collection(db, "vehicles");
  const snapshot = await getDocs(vehiclesRef);
  return snapshot.docs.map((docSnap) => ({
    vehicle_id: docSnap.id,
    ...docSnap.data(),
  }));
}

export async function countActiveCompanies() {
  if (!isFirebaseConfigured || !db) {
    return mockCompanies.filter((c) => c.active !== false).length;
  }

  const companiesRef = collection(db, "companies");
  const activeQuery = query(companiesRef, where("active", "==", true));
  const snapshot = await getCountFromServer(activeQuery);
  return snapshot.data().count;
}

export async function countActiveVehicles() {
  if (!isFirebaseConfigured || !db) {
    return mockVehicles.filter((v) => v.status !== "inactive").length;
  }

  const vehiclesRef = collection(db, "vehicles");
  const activeQuery = query(vehiclesRef, where("status", "==", "active"));
  const snapshot = await getCountFromServer(activeQuery);
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
  const vehicle = {
    ...payload,
    vehicle_id: docRef.id,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  await setDoc(docRef, vehicle);
  return { vehicle_id: docRef.id };
}

export { isFirebaseConfigured };
