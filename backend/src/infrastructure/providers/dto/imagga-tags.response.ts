export interface ImaggaTagsResponse {
  result?: {
    tags?: Array<{ confidence?: number; tag?: { en?: string } }>;
  };
}
