export interface AnalyzeResponseBody {
  tags: Array<{ label: string; confidence: number }>;
}
