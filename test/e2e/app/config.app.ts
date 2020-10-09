import { Module } from '@nestjs/common';
import { KafkaModule, KafkaAvroResponseDeserializer } from "../../../src";
import { TestConsumer } from "./test.controller";

@Module({
  imports: [
    KafkaModule.register([
      {
        name: 'KAFKA_SERVICE',
        options: {
          client: {
            clientId: 'test-e2e',
            brokers: ['localhost:9092'],
            retry: {
              retries: 0,
              initialRetryTime: 1,
            },
          },
          consumer: {
            groupId: 'test-e2e-consumer',
          },
          deserializer: new KafkaAvroResponseDeserializer({
            host: 'http://localhost:8081/'
          }),
          consumeFromBeginning: true
        }
      },
    ]),
    TestConsumer
  ],
})
export default class AppModule {}
