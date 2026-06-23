export type ListingStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface ProductInput {
  productName: string;
  category?: string;
  attributes?: Record<string, string>;
}

export interface GeneratedContent {
  title: string;
  bullets: string[];
  description: string;
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
}

export interface UploadResponse {
  success: boolean;
  count: number;
  batchId: string;
}
