import { Module, DynamicModule, Global } from '@nestjs/common';
import { KafkaService } from './kafka.service';
import { KafkaModuleOption } from "./interfaces";

@Global()
@Module({})
export class KafkaModule {
  static register(options: KafkaModuleOption[]): DynamicModule {
    const clients = (options || []).map(item => ({
      provide: item.name,
      useValue: new KafkaService(item.options),
    }));

    return {
      module: KafkaModule,
      providers: clients,
      exports: clients,
    };
  }
}
