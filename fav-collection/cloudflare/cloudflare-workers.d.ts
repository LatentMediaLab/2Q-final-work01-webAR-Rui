interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

interface DurableObjectState {
  readonly storage: DurableObjectStorage;
}

declare module "cloudflare:workers" {
  export class DurableObject<Environment = unknown> {
    protected readonly ctx: DurableObjectState;
    protected readonly env: Environment;

    public constructor(
      context: DurableObjectState,
      environment: Environment,
    );
  }
}
