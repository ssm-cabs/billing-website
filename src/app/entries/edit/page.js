import ClientEditEntryPage from "./client";

export default async function EditEntryPage({ searchParams }) {
  const params = await searchParams;
  const id = typeof params?.id === "string" ? params.id : "";

  return <ClientEditEntryPage id={id} />;
}
