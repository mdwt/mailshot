import * as path from "node:path";

export { handler as sendEmailHandler } from "./handlers/send-email.js";
export { handler as checkConditionHandler } from "./handlers/check-condition.js";
export { handler as unsubscribeHandler } from "./handlers/unsubscribe.js";
export { handler as bounceHandlerHandler } from "./handlers/bounce-handler.js";
export { handler as engagementHandlerHandler } from "./handlers/engagement-handler.js";

/** Absolute path to the handlers TypeScript source directory. Used by CDK constructs. */
export const HANDLERS_SRC_DIR = path.join(__dirname, "../src");
