import type { SuperpositionClient } from "./client";
import type {
  Experiment,
  ExperimentListFilters,
  ConcludeExperimentRequest,
  CreateExperimentRequest,
  DiscardExperimentRequest,
  PauseExperimentRequest,
  PaginatedResponse,
  PaginationParams,
  RampExperimentRequest,
  ResumeExperimentRequest,
} from "../types";

export function experimentsApi(client: SuperpositionClient) {
  return {
    list(
      params: PaginationParams = {},
      filters: ExperimentListFilters = {},
    ): Promise<PaginatedResponse<Experiment>> {
      return client.get("/experiments", { ...params, ...filters });
    },

    get(id: string): Promise<Experiment> {
      return client.get(`/experiments/${encodeURIComponent(id)}`);
    },

    create(req: CreateExperimentRequest): Promise<Experiment> {
      return client.post("/experiments", req);
    },

    ramp(id: string, req: RampExperimentRequest): Promise<Experiment> {
      return client.patch(`/experiments/${encodeURIComponent(id)}/ramp`, req);
    },

    pause(id: string, req: PauseExperimentRequest): Promise<Experiment> {
      return client.patch(`/experiments/${encodeURIComponent(id)}/pause`, req);
    },

    resume(id: string, req: ResumeExperimentRequest): Promise<Experiment> {
      return client.patch(`/experiments/${encodeURIComponent(id)}/resume`, req);
    },

    conclude(id: string, req: ConcludeExperimentRequest): Promise<Experiment> {
      return client.patch(`/experiments/${encodeURIComponent(id)}/conclude`, req);
    },

    discard(id: string, req: DiscardExperimentRequest): Promise<Experiment> {
      return client.patch(`/experiments/${encodeURIComponent(id)}/discard`, req);
    },
  };
}
