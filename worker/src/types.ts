export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface Env {
  APP_PASSWORD: string;
  TOKEN_SECRET: string;
  ALLOWED_ORIGIN: string;
  KOKPIT: KVLike;
}
