import { exports } from "cloudflare:workers";
import type { Persona, PullResponse, PushResponse } from "@shared/sync";
import { newId } from "@shared/ids";
import type { MutationInput, MutationName } from "@shared/mutations";

/** Calls the Worker the way a browser would, keeping the persona cookie. */
export class TestClient {
  private cookie = "";

  async request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (this.cookie) headers.set("Cookie", this.cookie);
    if (init.body) headers.set("Content-Type", "application/json");
    const res = await exports.default.fetch(`https://test.local${path}`, { ...init, headers });
    const setCookie = res.headers.get("Set-Cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0] ?? "";
    return res;
  }

  async json<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.request(path, init);
    return res.json<T>();
  }

  async personas(): Promise<Persona[]> {
    return (await this.json<{ personas: Persona[] }>("/api/personas")).personas;
  }

  /** Signs in as the first demo persona with this role. */
  async signInAs(role: Persona["role"]): Promise<Persona> {
    const persona = (await this.personas()).find((p) => p.role === role);
    if (!persona) throw new Error(`No demo persona with role ${role}`);
    await this.request("/api/personas/select", {
      method: "POST",
      body: JSON.stringify({ staffId: persona.id }),
    });
    return persona;
  }

  async mutate<N extends MutationName>(
    name: N,
    args: MutationInput<N>,
    id: string = newId(),
  ): Promise<PushResponse> {
    return this.json<PushResponse>("/api/sync/push", {
      method: "POST",
      body: JSON.stringify({ mutations: [{ id, name, args, createdAt: Date.now() }] }),
    });
  }

  async pull(cursor = 0): Promise<PullResponse> {
    return this.json<PullResponse>(`/api/sync/pull?cursor=${cursor}`);
  }
}
