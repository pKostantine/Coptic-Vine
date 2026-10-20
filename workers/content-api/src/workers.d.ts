/** The part of the Workers runtime module this Worker uses. */
declare module 'cloudflare:workers' {
  export class WorkerEntrypoint<Env = unknown> {
    protected readonly env: Env;
    protected readonly ctx: unknown;
    constructor(ctx: unknown, env: Env);
  }
}
