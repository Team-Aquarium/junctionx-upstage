import { FeedClient } from "./feed-client";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const { demo } = await searchParams;
  return <FeedClient demo={demo === "1"} />;
}
