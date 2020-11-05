import { join } from 'path';
import { Module } from '@nestjs/common';
import { KafkaModule, KafkaAvroResponseDeserializer, KafkaAvroRequestSerializer } from "../../../src";
import { TOPIC_NAME, TestConsumer } from "./test.controller";

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
              retries: 2,
              initialRetryTime: 30,
            },
          },
          consumer: {
            groupId: 'test-e2e-consumer',
          },
          deserializer: new KafkaAvroResponseDeserializer({
            host: 'http://localhost:8081/'
          }),
          serializer: new KafkaAvroRequestSerializer({
            config: {
              host: 'http://localhost:8081/'
            },
            schemas: [
              {
                topic: TOPIC_NAME,
                key: join(__dirname, 'key-schema.avsc'),
                value: join(__dirname, 'value-schema.avsc')
              }
            ],
          }),
          consumeFromBeginning: true
        }
      },
    ]),
    TestConsumer
  ],
})
export default class AppModule {}
