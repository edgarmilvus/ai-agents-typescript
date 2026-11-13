// The guard between a recording and the task it is about to answer.

import { taskHash } from "./recording.ts";
import type { Recording } from "./recording.ts";

export class RecordingError extends Error {}

export function assertSameTask(recording: Recording, task: string): void {
  const actual = taskHash(task);
  if (actual !== recording.taskHash) {
    throw new RecordingError(
      `recording was made for a different task: recorded ${recording.taskHash}, asked ${actual}`,
    );
  }
}
