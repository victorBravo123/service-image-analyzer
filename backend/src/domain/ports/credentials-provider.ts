import type { AnnotatorCredentials } from '../model/annotator-credentials';

export interface CredentialsProvider {
  getAnnotatorCredentials(): Promise<AnnotatorCredentials>;
}
