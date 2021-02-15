import { Module, DynamicModule, Global, Provider } from '@nestjs/common';
import { KafkaService } from './kafka.service';
import { KafkaModuleOption, KafkaModuleOptionsAsync, KafkaOptionsFactory } from './interfaces';
import { KafkaModuleOptionsProvider } from './kafka-module-options.provider';
import { KAFKA_MODULE_OPTIONS } from './constants';

@Global()
@Module({})
export class KafkaModule {
  static register(options: KafkaModuleOption[]): DynamicModule {
    const clients = (options || []).map((item) => ({
      provide: item.name,
      useValue: new KafkaService(item.options),
    }));

    return {
      module: KafkaModule,
      providers: clients,
      exports: clients,
    };
  }

  public static registerAsync(
    consumers: string[],
    connectOptions: KafkaModuleOptionsAsync,
  ): DynamicModule {
    const clients = [];
    for (const consumer of consumers) {
      clients.push({
        provide: consumer,
        useFactory: async (
          kafkaModuleOptionsProvider: KafkaModuleOptionsProvider,
        ) => {
          return new KafkaService(
            kafkaModuleOptionsProvider.getOptionsByName(consumer),
          );
        },
        inject: [KafkaModuleOptionsProvider],
      });
    }

    const createKafkaModuleOptionsProvider = this.createKafkaModuleOptionsProvider(connectOptions);

    return {
      module: KafkaModule,
      imports: connectOptions.imports || [],
      providers: [
        createKafkaModuleOptionsProvider,
        KafkaModuleOptionsProvider,
        ...clients,
      ],
      exports: [
        createKafkaModuleOptionsProvider,
        ...clients,
      ],
    };
  }

  private static createKafkaModuleOptionsProvider(
    options: KafkaModuleOptionsAsync,
  ): Provider {
    if (options.useFactory) {
      return {
        provide: KAFKA_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }
    return {
      provide: KAFKA_MODULE_OPTIONS,
      useFactory: async (optionsFactory: KafkaOptionsFactory) =>
        await optionsFactory.creatKafkaModuleOptions(),
      inject: [options.useExisting || options.useClass],
    };
  }
}
