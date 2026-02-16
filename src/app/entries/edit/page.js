import { Suspense } from "react";
import ClientEditEntryPage from "./client";

export default function EditEntryPage() {
  return (
    <Suspense fallback={null}>
      <ClientEditEntryPage />
    </Suspense>
  );
}
