export const SERVICE = {
  NAME: 'service-image-analyzer',
  VERSION: '1.0.0',
} as const;

export const LOCAL_CREDENTIAL_KEYS = ['IMAGGA_API_KEY', 'IMAGGA_API_SECRET'] as const;

export type LocalCredentialKey = (typeof LOCAL_CREDENTIAL_KEYS)[number];
