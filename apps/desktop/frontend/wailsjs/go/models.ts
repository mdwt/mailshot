export namespace main {
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
}
