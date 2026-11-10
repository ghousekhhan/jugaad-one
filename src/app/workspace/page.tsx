import type { Metadata } from "next";
import { Workspace } from "@/components/workspace";
import { providerDirectory } from "@/lib/integrations/registry";
import { geminiConfigured } from "@/lib/integrations/gemini";
import { gnaniConfigured } from "@/lib/voice/gnani";
import { blankRequest, exampleRequest } from "@/lib/request";

export const metadata: Metadata = {
  title: "Agent workspace",
  description: "Talk to Jugaad, compare eligible offers and review your simulated checkout.",
};

export default async function WorkspacePage({ searchParams }: PageProps<"/workspace">) {
  const params = await searchParams;
  const initialDraft = params.example === "paneer" ? exampleRequest : blankRequest;
  return (
    <Workspace
      initialDraft={initialDraft}
      providers={providerDirectory}
      geminiAvailable={geminiConfigured()}
      voiceAvailable={gnaniConfigured()}
    />
  );
}
