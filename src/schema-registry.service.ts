import { Injectable, OnModuleInit, HttpService, Inject, CacheTTL, UseInterceptors, CacheInterceptor } from '@nestjs/common';
import { SchemaRegistryOption } from "./interfaces";
import { SCHEMA_TOPICS, SCHEMAS } from "./kafka.decorator"

@Injectable()
export class SchemaRegistryService implements OnModuleInit {

  @Inject(HttpService)
  private httpService: HttpService

  constructor(
    @Inject('SCHEMA_OPTIONS') private options: SchemaRegistryOption
  ) {
    this.options = options;
  }

  async onModuleInit(): Promise<void> {
    SCHEMA_TOPICS.forEach((version, topic) => this.fetchSchema(topic, version))
  }

  private async getSchemaVersion(topic: string): Promise<number> {
    const results = await this.httpService.get(`${this.options.url}/subjects/${topic}-value/versions`).toPromise();
    const latestVersion = results.data.pop();
    return latestVersion || 1;
  }

  @CacheTTL(3600)
  @UseInterceptors(CacheInterceptor)
  private async fetchSchema(topic: string, version?: number): Promise<any> {
    let schemaVersion = version;

    if (!version) {
      schemaVersion = await this.getSchemaVersion(topic);
    }

    const result = await this.httpService.get(`${this.options.url}/subjects/${topic}-value/versions/${schemaVersion}/schema`).toPromise();

    let schema = [];

    if (result.data.fields) {
      schema = result.data.fields
    }

    SCHEMAS.set(topic, schema);

    return SCHEMAS.get(topic);
  } 

}
