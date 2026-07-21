export namespace main {
  export class AwsCtx {
    profile: string;
    region: string;
    tableName: string;
    eventsTableName: string;
    stackName: string;

    static createFrom(source: any = {}) {
      return new AwsCtx(source);
    }

    constructor(source: any = {}) {
      if ("string" === typeof source) source = JSON.parse(source);
      this.profile = source["profile"];
      this.region = source["region"];
      this.tableName = source["tableName"];
      this.eventsTableName = source["eventsTableName"];
      this.stackName = source["stackName"];
    }
  }
  export class Counters {
    delivery: number;
    open: number;
    click: number;
    bounce: number;
    complaint: number;

    static createFrom(source: any = {}) {
      return new Counters(source);
    }

    constructor(source: any = {}) {
      if ("string" === typeof source) source = JSON.parse(source);
      this.delivery = source["delivery"];
      this.open = source["open"];
      this.click = source["click"];
      this.bounce = source["bounce"];
      this.complaint = source["complaint"];
    }
  }
  export class BroadcastRow {
    broadcastId: string;
    templateKey: string;
    subject: string;
    fromEmail: string;
    sentAt: string;
    audienceSize: number;
    counters: Counters;

    static createFrom(source: any = {}) {
      return new BroadcastRow(source);
    }

    constructor(source: any = {}) {
      if ("string" === typeof source) source = JSON.parse(source);
      this.broadcastId = source["broadcastId"];
      this.templateKey = source["templateKey"];
      this.subject = source["subject"];
      this.fromEmail = source["fromEmail"];
      this.sentAt = source["sentAt"];
      this.audienceSize = source["audienceSize"];
      this.counters = this.convertValues(source["counters"], Counters);
    }

    convertValues(a: any, classs: any, asMap: boolean = false): any {
      if (!a) {
        return a;
      }
      if (a.slice && a.map) {
        return (a as any[]).map((elem) => this.convertValues(elem, classs));
      } else if ("object" === typeof a) {
        if (asMap) {
          for (const key of Object.keys(a)) {
            a[key] = new classs(a[key]);
          }
          return a;
        }
        return new classs(a);
      }
      return a;
    }
  }
  export class CallerIdentity {
    account: string;
    arn: string;
    userId: string;
    region: string;
    profile: string;
    error: string;

    static createFrom(source: any = {}) {
      return new CallerIdentity(source);
    }

    constructor(source: any = {}) {
      if ("string" === typeof source) source = JSON.parse(source);
      this.account = source["account"];
      this.arn = source["arn"];
      this.userId = source["userId"];
      this.region = source["region"];
      this.profile = source["profile"];
      this.error = source["error"];
    }
  }

  export class DayCounts {
    date: string;
    delivery: number;
    open: number;
    click: number;
    bounce: number;
    complaint: number;

    static createFrom(source: any = {}) {
      return new DayCounts(source);
    }

    constructor(source: any = {}) {
      if ("string" === typeof source) source = JSON.parse(source);
      this.date = source["date"];
      this.delivery = source["delivery"];
      this.open = source["open"];
      this.click = source["click"];
      this.bounce = source["bounce"];
      this.complaint = source["complaint"];
    }
  }
  export class EventRow {
    email: string;
    eventType: string;
    templateKey: string;
    sequenceId: string;
    subject: string;
    timestamp: string;

    static createFrom(source: any = {}) {
      return new EventRow(source);
    }

    constructor(source: any = {}) {
      if ("string" === typeof source) source = JSON.parse(source);
      this.email = source["email"];
      this.eventType = source["eventType"];
      this.templateKey = source["templateKey"];
      this.sequenceId = source["sequenceId"];
      this.subject = source["subject"];
      this.timestamp = source["timestamp"];
    }
  }
  export class ExecRow {
    sequenceId: string;
    startedAt: string;
    transactional: boolean;

    static createFrom(source: any = {}) {
      return new ExecRow(source);
    }

    constructor(source: any = {}) {
      if ("string" === typeof source) source = JSON.parse(source);
      this.sequenceId = source["sequenceId"];
      this.startedAt = source["startedAt"];
      this.transactional = source["transactional"];
    }
  }
  export class FailedExec {
    stateMachine: string;
    name: string;
    startDate: string;
    stopDate: string;

    static createFrom(source: any = {}) {
      return new FailedExec(source);
    }

    constructor(source: any = {}) {
      if ("string" === typeof source) source = JSON.parse(source);
      this.stateMachine = source["stateMachine"];
      this.name = source["name"];
      this.startDate = source["startDate"];
      this.stopDate = source["stopDate"];
    }
  }
  export class ProjectInfo {
    path: string;
    name: string;
    hasEnv: boolean;
    env: Record<string, string>;
    issues: string[];
    sequenceCount: number;

    static createFrom(source: any = {}) {
      return new ProjectInfo(source);
    }

    constructor(source: any = {}) {
      if ("string" === typeof source) source = JSON.parse(source);
      this.path = source["path"];
      this.name = source["name"];
      this.hasEnv = source["hasEnv"];
      this.env = source["env"];
      this.issues = source["issues"];
      this.sequenceCount = source["sequenceCount"];
    }
  }
  export class RecentProject {
    path: string;
    name: string;
    lastOpened: string;

    static createFrom(source: any = {}) {
      return new RecentProject(source);
    }

    constructor(source: any = {}) {
      if ("string" === typeof source) source = JSON.parse(source);
      this.path = source["path"];
      this.name = source["name"];
      this.lastOpened = source["lastOpened"];
    }
  }
  export class RenderResult {
    ok: boolean;
    output: string;

    static createFrom(source: any = {}) {
      return new RenderResult(source);
    }

    constructor(source: any = {}) {
      if ("string" === typeof source) source = JSON.parse(source);
      this.ok = source["ok"];
      this.output = source["output"];
    }
  }
  export class SendRow {
    sentAt: string;
    templateKey: string;
    sequenceId: string;
    subject: string;

    static createFrom(source: any = {}) {
      return new SendRow(source);
    }

    constructor(source: any = {}) {
      if ("string" === typeof source) source = JSON.parse(source);
      this.sentAt = source["sentAt"];
      this.templateKey = source["templateKey"];
      this.sequenceId = source["sequenceId"];
      this.subject = source["subject"];
    }
  }
  export class SeqSubscriberRow {
    email: string;
    startedAt: string;
    transactional: boolean;

    static createFrom(source: any = {}) {
      return new SeqSubscriberRow(source);
    }

    constructor(source: any = {}) {
      if ("string" === typeof source) source = JSON.parse(source);
      this.email = source["email"];
      this.startedAt = source["startedAt"];
      this.transactional = source["transactional"];
    }
  }
  export class SequenceEntry {
    dir: string;
    configPath: string;
    id: string;
    definition: string;
    error: string;

    static createFrom(source: any = {}) {
      return new SequenceEntry(source);
    }

    constructor(source: any = {}) {
      if ("string" === typeof source) source = JSON.parse(source);
      this.dir = source["dir"];
      this.configPath = source["configPath"];
      this.id = source["id"];
      this.definition = source["definition"];
      this.error = source["error"];
    }
  }
  export class SequenceRuntime {
    sequenceId: string;
    activeExecutions: number;
    counters: Counters;
    error: string;

    static createFrom(source: any = {}) {
      return new SequenceRuntime(source);
    }

    constructor(source: any = {}) {
      if ("string" === typeof source) source = JSON.parse(source);
      this.sequenceId = source["sequenceId"];
      this.activeExecutions = source["activeExecutions"];
      this.counters = this.convertValues(source["counters"], Counters);
      this.error = source["error"];
    }

    convertValues(a: any, classs: any, asMap: boolean = false): any {
      if (!a) {
        return a;
      }
      if (a.slice && a.map) {
        return (a as any[]).map((elem) => this.convertValues(elem, classs));
      } else if ("object" === typeof a) {
        if (asMap) {
          for (const key of Object.keys(a)) {
            a[key] = new classs(a[key]);
          }
          return a;
        }
        return new classs(a);
      }
      return a;
    }
  }
  export class SesHealth {
    max24HourSend: number;
    sentLast24Hours: number;
    maxSendRate: number;
    sendingEnabled: boolean;
    productionAccess: boolean;
    error: string;

    static createFrom(source: any = {}) {
      return new SesHealth(source);
    }

    constructor(source: any = {}) {
      if ("string" === typeof source) source = JSON.parse(source);
      this.max24HourSend = source["max24HourSend"];
      this.sentLast24Hours = source["sentLast24Hours"];
      this.maxSendRate = source["maxSendRate"];
      this.sendingEnabled = source["sendingEnabled"];
      this.productionAccess = source["productionAccess"];
      this.error = source["error"];
    }
  }
  export class StackOutput {
    key: string;
    value: string;

    static createFrom(source: any = {}) {
      return new StackOutput(source);
    }

    constructor(source: any = {}) {
      if ("string" === typeof source) source = JSON.parse(source);
      this.key = source["key"];
      this.value = source["value"];
    }
  }
  export class StackInfo {
    name: string;
    status: string;
    lastUpdated: string;
    outputs: StackOutput[];
    error: string;

    static createFrom(source: any = {}) {
      return new StackInfo(source);
    }

    constructor(source: any = {}) {
      if ("string" === typeof source) source = JSON.parse(source);
      this.name = source["name"];
      this.status = source["status"];
      this.lastUpdated = source["lastUpdated"];
      this.outputs = this.convertValues(source["outputs"], StackOutput);
      this.error = source["error"];
    }

    convertValues(a: any, classs: any, asMap: boolean = false): any {
      if (!a) {
        return a;
      }
      if (a.slice && a.map) {
        return (a as any[]).map((elem) => this.convertValues(elem, classs));
      } else if ("object" === typeof a) {
        if (asMap) {
          for (const key of Object.keys(a)) {
            a[key] = new classs(a[key]);
          }
          return a;
        }
        return new classs(a);
      }
      return a;
    }
  }

  export class SubscriberDetail {
    found: boolean;
    profileJson: string;
    executions: ExecRow[];
    sendLog: SendRow[];
    suppression: string;
    error: string;

    static createFrom(source: any = {}) {
      return new SubscriberDetail(source);
    }

    constructor(source: any = {}) {
      if ("string" === typeof source) source = JSON.parse(source);
      this.found = source["found"];
      this.profileJson = source["profileJson"];
      this.executions = this.convertValues(source["executions"], ExecRow);
      this.sendLog = this.convertValues(source["sendLog"], SendRow);
      this.suppression = source["suppression"];
      this.error = source["error"];
    }

    convertValues(a: any, classs: any, asMap: boolean = false): any {
      if (!a) {
        return a;
      }
      if (a.slice && a.map) {
        return (a as any[]).map((elem) => this.convertValues(elem, classs));
      } else if ("object" === typeof a) {
        if (asMap) {
          for (const key of Object.keys(a)) {
            a[key] = new classs(a[key]);
          }
          return a;
        }
        return new classs(a);
      }
      return a;
    }
  }
  export class TagRow {
    email: string;
    taggedAt: string;

    static createFrom(source: any = {}) {
      return new TagRow(source);
    }

    constructor(source: any = {}) {
      if ("string" === typeof source) source = JSON.parse(source);
      this.email = source["email"];
      this.taggedAt = source["taggedAt"];
    }
  }
  export class TemplateEntry {
    name: string;
    templateKey: string;
    sourcePath: string;
    builtPath: string;
    status: string;

    static createFrom(source: any = {}) {
      return new TemplateEntry(source);
    }

    constructor(source: any = {}) {
      if ("string" === typeof source) source = JSON.parse(source);
      this.name = source["name"];
      this.templateKey = source["templateKey"];
      this.sourcePath = source["sourcePath"];
      this.builtPath = source["builtPath"];
      this.status = source["status"];
    }
  }
  export class TemplateStat {
    templateKey: string;
    counters: Counters;
    truncated: boolean;
    error: string;

    static createFrom(source: any = {}) {
      return new TemplateStat(source);
    }

    constructor(source: any = {}) {
      if ("string" === typeof source) source = JSON.parse(source);
      this.templateKey = source["templateKey"];
      this.counters = this.convertValues(source["counters"], Counters);
      this.truncated = source["truncated"];
      this.error = source["error"];
    }

    convertValues(a: any, classs: any, asMap: boolean = false): any {
      if (!a) {
        return a;
      }
      if (a.slice && a.map) {
        return (a as any[]).map((elem) => this.convertValues(elem, classs));
      } else if ("object" === typeof a) {
        if (asMap) {
          for (const key of Object.keys(a)) {
            a[key] = new classs(a[key]);
          }
          return a;
        }
        return new classs(a);
      }
      return a;
    }
  }
}
