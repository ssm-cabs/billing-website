import { fetchEntries } from "@/lib/api";
import ClientEditEntryPage from "./client";

export async function generateStaticParams() {
  try {
    const entries = await fetchEntries();
    return entries.map((entry) => ({
      id: entry.entry_id,
    }));
  } catch (err) {
    return [];
  }
}

export default function EditEntryPage({ params }) {
  return <ClientEditEntryPage id={params.id} />;
}
