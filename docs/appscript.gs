const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID";
const PRICING_SHEET = "Pricing";

function doGet(e) {
  const { path = "", company = "", date = "" } = e.parameter;
  if (path === "pricing") return jsonResponse(getPricing(company));
  if (path === "entries") return jsonResponse(listEntries(company, date));
  return jsonResponse({ message: "OK" });
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents || "{}");
  if (body.path === "entries") return jsonResponse(createEntry(body));
  return jsonResponse({ error: "Unsupported POST" }, 400);
}

function doPut(e) {
  const body = JSON.parse(e.postData.contents || "{}");
  if (body.path === "entries") return jsonResponse(updateEntry(body));
  return jsonResponse({ error: "Unsupported PUT" }, 400);
}

function doDelete(e) {
  const body = JSON.parse(e.postData.contents || "{}");
  if (body.path === "entries") return jsonResponse(deleteEntry(body));
  return jsonResponse({ error: "Unsupported DELETE" }, 400);
}

function doOptions() {
  return jsonResponse({ ok: true });
}

function listEntries(company, date) {
  const sheet = getCompanySheet(company);
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift();
  const entries = rows.map((row) => toObject(headers, row));

  if (date) {
    return {
      entries: entries.filter((entry) =>
        String(entry.entry_date || "").startsWith(date)
      ),
    };
  }

  return { entries };
}

function createEntry(payload) {
  const sheet = getCompanySheet(payload.company_name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const entry = {
    entry_id: "ENT-" + new Date().getTime(),
    entry_date: payload.entry_date,
    company_name: payload.company_name,
    cab_type: payload.cab_type,
    slot: payload.slot,
    rate: payload.rate || "",
    amount: payload.amount || "",
    pickup_location: payload.pickup_location,
    drop_location: payload.drop_location,
    driver_name: payload.driver_name,
    vehicle_number: payload.vehicle_number,
    notes: payload.notes || "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  sheet.appendRow(headers.map((header) => entry[header] ?? ""));
  return { entry_id: entry.entry_id };
}

function updateEntry(payload) {
  const sheet = getCompanySheet(payload.company_name);
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift();
  const idIndex = headers.indexOf("entry_id");
  const rowIndex = rows.findIndex((row) => row[idIndex] === payload.entry_id);
  if (rowIndex === -1) return { error: "Entry not found" };

  const entry = { ...toObject(headers, rows[rowIndex]), ...payload };
  entry.updated_at = new Date().toISOString();

  sheet
    .getRange(rowIndex + 2, 1, 1, headers.length)
    .setValues([headers.map((header) => entry[header] ?? "")]);

  return { entry_id: entry.entry_id };
}

function deleteEntry(payload) {
  const sheet = getCompanySheet(payload.company_name);
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift();
  const idIndex = headers.indexOf("entry_id");
  const rowIndex = rows.findIndex((row) => row[idIndex] === payload.entry_id);
  if (rowIndex === -1) return { error: "Entry not found" };

  sheet.deleteRow(rowIndex + 2);
  return { entry_id: payload.entry_id };
}

function getPricing(company) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(
    PRICING_SHEET
  );
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift();
  const pricing = rows.map((row) => toObject(headers, row));
  return {
    pricing: company
      ? pricing.filter((item) => item.company_name === company)
      : pricing,
  };
}

function getCompanySheet(company) {
  if (!company) throw new Error("company_name is required");
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(company);
  if (!sheet) throw new Error("Company sheet not found");
  return sheet;
}

function toObject(headers, row) {
  const obj = {};
  headers.forEach((header, index) => {
    obj[header] = row[index];
  });
  return obj;
}

function jsonResponse(data, status) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  if (status) output.setStatusCode(status);
  if (typeof output.setHeader === "function") {
    output.setHeader("Access-Control-Allow-Origin", "*");
    output.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    output.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  return output;
}
