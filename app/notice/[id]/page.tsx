import { NoticeClient } from "./notice-client";

export default async function NoticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <NoticeClient id={id} />;
}
