// Small, pure helper describing health status — kept separate from the route
// handler so it can be unit-tested without a database or HTTP layer.
export type HealthStatus = {
  status: "ok" | "degraded";
  db: "up" | "down";
};

export function healthStatus(dbUp: boolean): HealthStatus {
  return dbUp
    ? { status: "ok", db: "up" }
    : { status: "degraded", db: "down" };
}
