import { Suspense } from "react";
import ClientViewEntryPage from "./client";

export default function ViewEntryPage() {
  return (
    <Suspense fallback={null}>
      <ClientViewEntryPage />
    </Suspense>
  );
}
