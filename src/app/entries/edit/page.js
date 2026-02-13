import ClientEditEntryPage from "./client";

export default function EditEntryPage({ searchParams }) {
  const id = typeof searchParams?.id === "string" ? searchParams.id : "";

  return <ClientEditEntryPage id={id} />;
}
