import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pitch — Moabora",
  description:
    "Team Aquarium pitch narration for Moabora, the Upstage Document Agent.",
};

export default function PitchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
