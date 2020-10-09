import { Inject, Post } from '@nestjs/common';
import { Payload } from "@nestjs/microservices";
import { ProducerRecord } from 'kafkajs';
import { SubscribeTo, KafkaService } from "../../../dist";

export const TOPIC_NAME = 'test.topic';

export class TestConsumer {

  constructor(
    @Inject('KAFKA_SERVICE') private client: KafkaService
  ) {
  }

  onModuleInit(): void {
    this.client.subscribeToResponseOf(TOPIC_NAME, this)
  }

  @SubscribeTo(TOPIC_NAME)
  async message(@Payload() data: any): Promise<void> {
    console.log(data);
  }

  @Post()
  async sendMessage(messages: ProducerRecord["messages"]) {
    console.log('sending!!', messages);
    return await this.client.send({
      topic: TOPIC_NAME,

      messages,
    });
  }
}
