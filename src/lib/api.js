import {
  addDoc,
  collection,
  doc,
  getDocs,
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

export async function fetchEntries({ company = "", month = "" } = {}) {
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

export { isFirebaseConfigured };
