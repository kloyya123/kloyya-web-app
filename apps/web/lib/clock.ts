/**
 * The application clock.
 *
 * The UI needs "now" to say how many days a deadline is away. In production that
 * is simply the wall clock. In the mock it is the *narrative* clock — the demo
 * lives on a pinned day, and comparing against real time would age Atlas's
 * deadline into the past and quietly rot every screen.
 *
 * Rather than let a component import MOCK_NOW (which would mean deleting the
 * mock folder breaks the UI), the clock is injectable and the mock service
 * registry installs the narrative one. The Engineering Quality Gate is explicit:
 * "Only the data layer should change when moving from mock data to production
 * APIs." The data layer sets the clock; the UI just reads it. Attaching a real
 * backend means not calling `setClock`, and the default — real time — takes over.
 */

let read: () => Date = () => new Date();

/** The current time, per whatever clock is installed. */
export function now(): Date {
  return read();
}

/** Install a clock. Called by the mock data layer; a real backend never calls it. */
export function setClock(source: () => Date): void {
  read = source;
}
