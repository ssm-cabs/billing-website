const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://script.google.com/macros/s/AKfycbwGRdDT29n44-8cDmfQ_UR4R35j6Y2z3FLrX7SDtSbSPTWdEzBDf2hFBGN9akWnuGhqsg/exec";

const hasRealApi =
  API_BASE_URL &&
  API_BASE_URL !== "YOUR_APPS_SCRIPT_URL" &&
  !API_BASE_URL.includes("docs.google.com");

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

async function request(path, options = {}) {
  if (!hasRealApi) {
    return { ok: true, data: null };
  }

  const response = await fetch(`${API_BASE_URL}${path}`, options);

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.message || "Request failed";
    throw new Error(message);
  }

  return { ok: true, data };
}

export async function fetchEntries({ company = "", month = "" } = {}) {
  if (!hasRealApi) {
    return mockEntries;
  }

  const query = new URLSearchParams();
  query.set("path", "entries");
  if (company) query.set("company", company);
  if (month) query.set("date", month);

  const { data } = await request(`?${query.toString()}`);
  return data?.entries || [];
}

export async function createEntry(payload) {
  if (!hasRealApi) {
    return { ok: true, entry_id: "ENT-NEW" };
  }

  const { data } = await request("", {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ path: "entries", ...payload }),
  });

  return data;
}

export { hasRealApi, API_BASE_URL };
