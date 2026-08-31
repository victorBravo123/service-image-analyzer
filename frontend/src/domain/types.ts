export interface Tag {
  label: string;
  confidence: number;
}

export interface AnalysisResult {
  tags: Tag[];
}
