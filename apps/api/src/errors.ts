export class ApiError extends Error {
  constructor(
    public status: 400 | 401 | 402 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503,
    public code: string,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const unauthorized = (msg = "Sign in or provide a valid license key.") => new ApiError(401, "unauthorized", msg);
export const notFound = (what = "Resource") => new ApiError(404, "not_found", `${what} not found.`);
export const planRequired = (feature: string, needed: "pro" | "studio" = "pro") =>
  new ApiError(402, "plan_required", `${feature} is part of the ${needed === "pro" ? "Pro" : "Studio"} plan.`, { needed });
