import type { ZodType } from "zod";

export class PvpokeDataError extends Error {
  constructor(
    message: string,
    readonly resource: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PvpokeDataError";
  }
}

export async function fetchValidatedJson<T>(
  resource: string,
  schema: ZodType<T>,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(resource);
  } catch (error) {
    throw new PvpokeDataError(
      `Could not connect to the PvPoke data source at ${resource}.`,
      resource,
      { cause: error },
    );
  }

  if (!response.ok) {
    throw new PvpokeDataError(
      `PvPoke returned ${String(response.status)} for ${resource}.`,
      resource,
    );
  }

  let data: unknown;

  try {
    data = (await response.json()) as unknown;
  } catch (error) {
    throw new PvpokeDataError(
      `PvPoke returned invalid JSON for ${resource}.`,
      resource,
      { cause: error },
    );
  }

  const result = schema.safeParse(data);

  if (!result.success) {
    throw new PvpokeDataError(
      `PvPoke data at ${resource} does not match TeamLab's expected schema.`,
      resource,
      { cause: result.error },
    );
  }

  return result.data;
}
