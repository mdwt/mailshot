import { SFNClient, StopExecutionCommand } from "@aws-sdk/client-sfn";
import { getAllExecutions, deleteExecution } from "./dynamo-client.js";
import { createLogger } from "./logger.js";

const logger = createLogger("execution-stopper");
const sfn = new SFNClient({});

export async function stopAllExecutions(tableName: string, email: string): Promise<void> {
  const executions = await getAllExecutions(tableName, email);
  logger.info("Stopping all executions for subscriber", {
    email,
    executionCount: executions.length,
  });

  await Promise.all(
    executions.map(async (exec) => {
      try {
        await sfn.send(
          new StopExecutionCommand({
            executionArn: exec.executionArn,
            cause: "Subscriber unsubscribed or suppressed",
          }),
        );
        logger.info("Stopped execution", {
          email,
          sequenceId: exec.sequenceId,
          executionArn: exec.executionArn,
        });
      } catch (err) {
        logger.warn("Failed to stop execution (may already be stopped)", {
          email,
          sequenceId: exec.sequenceId,
          executionArn: exec.executionArn,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      await deleteExecution(tableName, email, exec.sequenceId);
    }),
  );
}
