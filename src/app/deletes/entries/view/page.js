import { Suspense } from "react";
import ClientDeletedEntryPage from "./client";

export default function DeletedEntryViewPage() {
  return (
    <Suspense fallback={null}>
      <ClientDeletedEntryPage />
    </Suspense>
  );
}
