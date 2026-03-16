import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

export interface SsmConstructProps {
  prefix: string;
  tableName: string;
  eventsTableName: string;
  templateBucketName: string;
  defaultFromEmail: string;
  defaultFromName: string;
  sesConfigSetName: string;
  unsubscribeBaseUrl: string;
  unsubscribeSecret: string;
  rateLimitCount: number;
  rateLimitWindowHours: number;
}

export class SsmConstruct extends Construct {
  constructor(scope: Construct, id: string, props: SsmConstructProps) {
    super(scope, id);

    const params: Record<string, string> = {
      "table-name": props.tableName,
      "events-table-name": props.eventsTableName,
      "template-bucket": props.templateBucketName,
      "default-from-email": props.defaultFromEmail,
      "default-from-name": props.defaultFromName,
      "ses-config-set": props.sesConfigSetName,
      "unsubscribe-base-url": props.unsubscribeBaseUrl,
      "unsubscribe-secret": props.unsubscribeSecret,
      "rate-limit-count": String(props.rateLimitCount),
      "rate-limit-window-hours": String(props.rateLimitWindowHours),
    };

    for (const [key, value] of Object.entries(params)) {
      new ssm.StringParameter(this, `Param-${key}`, {
        parameterName: `${props.prefix}/${key}`,
        stringValue: value,
        description: `Email Sequencer: ${key}`,
      });
    }
  }
}
