import { IngestClient } from "./ingest-client";

export default async function IngestPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const { demo } = await searchParams;
  return <IngestClient demo={demo === "1"} />;
}
