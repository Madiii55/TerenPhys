import { createEinsteinHandler } from '../_shared/einstein.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

Deno.serve(createEinsteinHandler({ env: name => Deno.env.get(name) }));
