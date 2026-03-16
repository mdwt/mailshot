import {
  SFNClient,
  StopExecutionCommand,
} from "@aws-sdk/client-sfn";
import { getAllExecutions, deleteExecution } from "./dynamo-client.js";

const sfn = new SFNClient({});

export async function stopAllExecutions(
  tableName: string,
  email: string,
): Promise<void> {
  const executions = await getAllExecutions(tableName, email);
  await Promise.all(
    executions.map(async (exec) => {
      try {
        await sfn.send(
          new StopExecutionCommand({
            executionArn: exec.executionArn,
            cause: "Subscriber unsubscribed or suppressed",
          }),
        );
      } catch {
        // Execution may already be stopped — ignore
      }
      await deleteExecution(tableName, email, exec.sequenceId);
    }),
  );
}
