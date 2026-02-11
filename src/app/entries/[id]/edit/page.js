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

export default async function EditEntryPage({ params }) {
  const { id } = await params;
  return <ClientEditEntryPage id={id} />;
}
