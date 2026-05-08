/* eslint-disable no-console */
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const COLLECTIONS = ["vehicles", "entries", "entry_update_requests"];
const SAMPLE_LIMIT = 25;

function normalizeVehicleNumber(value = "") {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

async function scanCollection(collectionName, dryRun = true) {
  const snapshot = await db.collection(collectionName).get();
  let total = 0;
  let changed = 0;
  const samples = [];

  let batch = db.batch();
  let ops = 0;

  for (const docSnap of snapshot.docs) {
    total += 1;
    const data = docSnap.data() || {};
    const current = String(data.vehicle_number || "");
    const normalized = normalizeVehicleNumber(current);

    if (current !== normalized) {
      changed += 1;
      if (samples.length < SAMPLE_LIMIT) {
        samples.push({
          id: docSnap.id,
          before: current,
          after: normalized,
        });
      }

      if (!dryRun) {
        batch.update(docSnap.ref, {
          vehicle_number: normalized,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        ops += 1;
        if (ops >= 400) {
          await batch.commit();
          batch = db.batch();
          ops = 0;
        }
      }
    }
  }

  if (!dryRun && ops > 0) {
    await batch.commit();
  }

  return {
    collectionName,
    total,
    changed,
    samples,
    mode: dryRun ? "dry-run" : "apply",
  };
}

async function main() {
  const applyMode = process.argv.includes("--apply");
  const dryRun = !applyMode;

  console.log(
    `Starting vehicle_number normalization in ${dryRun ? "DRY-RUN" : "APPLY"} mode`
  );

  const results = [];
  for (const collectionName of COLLECTIONS) {
    const result = await scanCollection(collectionName, dryRun);
    results.push(result);
    console.log(
      `\n[${collectionName}] scanned=${result.total}, to_change=${result.changed}, mode=${result.mode}`
    );
    if (result.samples.length) {
      console.log("  Sample changes:");
      result.samples.forEach((sample) => {
        console.log(
          `   - ${sample.id}: "${sample.before}" -> "${sample.after}"`
        );
      });
    } else {
      console.log("  No changes needed.");
    }
  }

  const totalScanned = results.reduce((sum, item) => sum + item.total, 0);
  const totalChanged = results.reduce((sum, item) => sum + item.changed, 0);
  console.log(
    `\nDone. scanned=${totalScanned}, ${dryRun ? "would_change" : "changed"}=${totalChanged}`
  );
}

main().catch((error) => {
  console.error("Normalization failed:", error);
  process.exitCode = 1;
});
