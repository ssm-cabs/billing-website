import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";

function getDeletedByFromLocalStorage() {
  if (typeof window === "undefined") {
    return {
      uid: "",
      phone: "",
      name: "",
      role: "",
    };
  }

  try {
    const raw = localStorage.getItem("user_data");
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      uid: String(parsed?.user_id || "").trim(),
      phone: String(parsed?.phone || "").trim(),
      name: String(parsed?.name || "").trim(),
      role: String(parsed?.role || "").trim().toLowerCase(),
    };
  } catch {
    return {
      uid: "",
      phone: "",
      name: "",
      role: "",
    };
  }
}

export async function archiveAndDeleteRef({
  sourceRef,
  sourceCollection,
  sourcePath,
  sourceDocId,
  sourceType,
  payload,
}) {
  if (!isFirebaseConfigured || !db || !sourceRef) {
    return { ok: true, archived: false };
  }

  const deleteRef = doc(collection(db, "deletes"));
  const deletedBy = getDeletedByFromLocalStorage();
  const batch = writeBatch(db);

  batch.set(deleteRef, {
    delete_id: deleteRef.id,
    source_collection: String(sourceCollection || "").trim(),
    source_path: String(sourcePath || "").trim(),
    source_doc_id: String(sourceDocId || "").trim(),
    source_type: String(sourceType || "").trim(),
    payload: payload || {},
    deleted_by: deletedBy,
    deleted_at: serverTimestamp(),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  batch.delete(sourceRef);
  await batch.commit();

  return { ok: true, archived: true, delete_id: deleteRef.id };
}

function normalizeDeleteDoc(data = {}, id = "") {
  return {
    delete_id: data.delete_id || id,
    source_collection: String(data.source_collection || "").trim(),
    source_path: String(data.source_path || "").trim(),
    source_doc_id: String(data.source_doc_id || "").trim(),
    source_type: String(data.source_type || "").trim(),
    payload: data.payload || {},
    deleted_by: data.deleted_by || {},
    deleted_at: data.deleted_at || null,
    created_at: data.created_at || null,
    updated_at: data.updated_at || null,
  };
}

export async function fetchDeletedDocuments(limitCount = 200) {
  if (!isFirebaseConfigured || !db) {
    return [];
  }

  const deletesRef = collection(db, "deletes");
  const q = query(
    deletesRef,
    orderBy("deleted_at", "desc"),
    limit(Math.max(1, Number(limitCount) || 200))
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) =>
    normalizeDeleteDoc(docSnap.data(), docSnap.id)
  );
}

export async function deleteArchivedDocument(deleteId) {
  const normalizedDeleteId = String(deleteId || "").trim();
  if (!normalizedDeleteId) {
    throw new Error("deleteId is required");
  }

  if (!isFirebaseConfigured || !db) {
    return { ok: true, delete_id: normalizedDeleteId };
  }

  await deleteDoc(doc(db, "deletes", normalizedDeleteId));
  return { ok: true, delete_id: normalizedDeleteId };
}

export async function fetchDeletedEntrySnapshotByDocId(docId) {
  const normalizedDocId = String(docId || "").trim();
  if (!normalizedDocId) {
    throw new Error("docId is required");
  }

  if (!isFirebaseConfigured || !db) {
    throw new Error("Deleted entry snapshot not available in demo mode");
  }

  const deletesRef = collection(db, "deletes");
  const q = query(
    deletesRef,
    where("source_collection", "==", "entries"),
    where("source_doc_id", "==", normalizedDocId),
    orderBy("deleted_at", "desc"),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    throw new Error("Deleted entry archive not found");
  }

  const latest = snapshot.docs[0];
  return normalizeDeleteDoc(latest.data(), latest.id);
}
