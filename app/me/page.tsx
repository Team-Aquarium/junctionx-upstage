import { ProfileClient } from "./me-client";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const { demo } = await searchParams;
  return <ProfileClient demo={demo === "1"} />;
}
