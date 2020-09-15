import { Module, DynamicModule, Global, HttpModule, CacheModule } from '@nestjs/common';
import { SchemaRegistryService } from './schema-registry.service';
import { SchemaRegistryOption } from "./interfaces";

@Global()
@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    CacheModule.register()
  ]
})
export class SchemaRegistry {
  static register(config: SchemaRegistryOption): DynamicModule {
    return {
      module: SchemaRegistry,
      providers: [
        {
          provide: 'SCHEMA_OPTIONS',
          useValue: config,
        },
        SchemaRegistryService
      ],
      exports: [SchemaRegistryService],
    };
  }
}
