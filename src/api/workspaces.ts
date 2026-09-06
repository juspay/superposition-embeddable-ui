import type { Workspace } from "../types";
import type { SuperpositionClient } from "./client";

export function workspacesApi(client: SuperpositionClient) {
  return {
    get(): Promise<Workspace> {
      return client.get(`/workspaces/${encodeURIComponent(client.workspace)}`);
    },
  };
}
