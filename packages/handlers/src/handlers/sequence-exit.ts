import { resolveConfig } from "../lib/config.js";
import { stopSequenceExecution } from "../lib/execution-stopper.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("sequence-exit");

interface SequenceExitEvent {
  email: string;
  sequenceId: string;
}

export const handler = async (event: SequenceExitEvent): Promise<{ stopped: boolean }> => {
  logger.info("SequenceExit invoked", { email: event.email, sequenceId: event.sequenceId });
  const config = resolveConfig();

  const stopped = await stopSequenceExecution(config.tableName, event.email, event.sequenceId);

  logger.info("SequenceExit complete", {
    email: event.email,
    sequenceId: event.sequenceId,
    stopped,
  });

  return { stopped };
};
