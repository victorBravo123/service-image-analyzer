declare module 'express-serve-static-core' {
  interface Request {
    idTransaction?: string;
    startTime?: number;
  }
}

export {};
