/** Thrown by server modules to control the HTTP status the API route replies with. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
