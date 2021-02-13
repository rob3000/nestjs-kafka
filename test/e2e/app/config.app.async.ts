import { Module } from '@nestjs/common';
import { KafkaModule, KafkaAvroResponseDeserializer, KafkaAvroRequestSerializer } from '../../../src';
import TestConfigModule from './test-config.module';
import { TestConfigService } from './test-config.service';
import { TOPIC_NAME, TestConsumer } from './test.controller';

@Module({
  imports: [
    KafkaModule.registerAsync(['KAFKA_SERVICE'], {
      imports: [TestConfigModule],
      useFactory: (testConfigService: TestConfigService) => {
        return [
          {
            name: 'KAFKA_SERVICE',
            options: {
              client: {
                clientId: 'test-e2e',
                brokers: [testConfigService.getBroker()],
                retry: {
                  retries: 2,
                  initialRetryTime: 30,
                },
              },
              consumer: {
                groupId: 'test-e2e-consumer',
                allowAutoTopicCreation: true,
              },
              deserializer: new KafkaAvroResponseDeserializer({
                host: testConfigService.getAvroHost(),
              }),
              serializer: new KafkaAvroRequestSerializer({
                config: {
                  host: testConfigService.getAvroHost(),
                },
                schemas: [
                  {
                    topic: TOPIC_NAME,
                    key: TOPIC_NAME,
                    value: TOPIC_NAME,
                  },
                ],
              }),
            },
          },
        ];
      },
      inject: [TestConfigService],
    }),
    TestConsumer,
  ],
})
export default class AppModule {}
