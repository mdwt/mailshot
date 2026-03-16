import * as ses from "aws-cdk-lib/aws-ses";
import * as sesActions from "aws-cdk-lib/aws-ses-actions";
import * as sns from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";

export interface SesConfigProps {
  configSetName: string;
  snsTopicName: string;
}

export class SesConfigConstruct extends Construct {
  public readonly configurationSet: ses.ConfigurationSet;
  public readonly snsTopic: sns.Topic;
  public readonly engagementTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: SesConfigProps) {
    super(scope, id);

    this.snsTopic = new sns.Topic(this, "SesNotificationsTopic", {
      topicName: props.snsTopicName,
    });

    this.engagementTopic = new sns.Topic(this, "SesEngagementTopic", {
      topicName: `${props.snsTopicName}-engagement`,
    });

    this.configurationSet = new ses.ConfigurationSet(
      this,
      "ConfigurationSet",
      {
        configurationSetName: props.configSetName,
      },
    );

    // Add SNS event destination for bounces and complaints
    this.configurationSet.addEventDestination("BounceAndComplaint", {
      destination: ses.EventDestination.snsTopic(this.snsTopic),
      events: [
        ses.EmailSendingEvent.BOUNCE,
        ses.EmailSendingEvent.COMPLAINT,
      ],
    });

    // Add SNS event destination for engagement events
    this.configurationSet.addEventDestination("Engagement", {
      destination: ses.EventDestination.snsTopic(this.engagementTopic),
      events: [
        ses.EmailSendingEvent.DELIVERY,
        ses.EmailSendingEvent.OPEN,
        ses.EmailSendingEvent.CLICK,
        ses.EmailSendingEvent.BOUNCE,
        ses.EmailSendingEvent.COMPLAINT,
      ],
    });
  }
}
