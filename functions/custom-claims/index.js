const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

const ALLOWED_ROLES = new Set(["user", "driver", "company"]);

function normalizeRole(value) {
  const role = String(value || "").trim().toLowerCase();
  return ALLOWED_ROLES.has(role) ? role : "";
}

exports.syncRoleClaim = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const uid = request.auth.uid;
  const phoneNumber = String(request.auth.token.phone_number || "").trim();
  if (!phoneNumber) {
    throw new HttpsError("permission-denied", "Phone number is missing in auth token.");
  }

  const usersRef = admin.firestore().collection("users");
  const snapshot = await usersRef.where("phone", "==", phoneNumber).limit(1).get();

  if (snapshot.empty) {
    throw new HttpsError("permission-denied", "User record not found.");
  }

  const userData = snapshot.docs[0].data() || {};
  const role = normalizeRole(userData.role);

  if (!role) {
    throw new HttpsError("permission-denied", "User role is invalid.");
  }

  const userRecord = await admin.auth().getUser(uid);
  const currentClaims = userRecord.customClaims || {};

  if (currentClaims.role !== role) {
    await admin.auth().setCustomUserClaims(uid, {
      ...currentClaims,
      role,
    });
  }

  return { ok: true, role };
});
