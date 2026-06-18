export type ManifestCategory =
  | "self"
  | "relationship"
  | "career"
  | "health"
  | "abundance"
  | "other";

export const MANIFEST_CATEGORY_LABELS: Record<ManifestCategory, string> = {
  self: "自我",
  relationship: "关系",
  career: "事业",
  health: "身心",
  abundance: "丰盛",
  other: "其他",
};

export const MANIFEST_CATEGORY_ICONS: Record<ManifestCategory, string> = {
  self: "🌱",
  relationship: "💕",
  career: "🎯",
  health: "🌿",
  abundance: "✨",
  other: "🔮",
};

export interface ManifestEntry {
  id: string;
  userId: string;
  createdAt: string;
  entryDate: string;
  intention: string;
  category: ManifestCategory;
  aiEcho: string | null;
  keywords: string[];
}

export interface ManifestCreateInput {
  intention: string;
  category: ManifestCategory;
}

export interface EchoResponse {
  echo: string;
}

export interface AnalyzeResponse {
  keywords: string[];
  insight: string;
}