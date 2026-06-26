export type ListingStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface ProductInput {
  productName: string;
  category?: string;
  attributes?: Record<string, string>;
}

export interface QualityFlags {
  no_trademarks?: boolean;
  title_in_range?: boolean;
  bullets_concise?: boolean;
  attrs_real?: boolean;
  hook_differentiated?: boolean;
}

export interface GeneratedContent {
  title: string;
  title_b?: string;
  bullets: string[];
  description: string;
  primary_keyword?: string;
  target_audience?: string;
  hook_type?: "scene" | "question" | "bold" | "benefit";
  quality_flags?: QualityFlags;
}

export interface ListingRow {
  id: string;
  userId: string;
  productName: string;
  category: string | null;
  attributes: Record<string, string> | null;
  styleProfileId: string | null;
  generatedTitle: string | null;
  generatedBullets: string[] | null;
  generatedDescription: string | null;
  status: ListingStatus;
  errorMessage: string | null;
  createdAt: number;
}

export interface BatchProcessPayload {
  batchId: string;
  userId: string;
  mode?: string;
  provider?: string;
}

export interface UploadResponse {
  success: boolean;
  count: number;
  batchId: string;
}
