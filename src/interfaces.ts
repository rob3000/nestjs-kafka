import { Deserializer, Serializer } from "@nestjs/microservices";
import { ConsumerConfig, KafkaConfig, ProducerConfig, ProducerRecord, Message } from "kafkajs";

export interface KafkaResponse<T = any> {
  response: T;
  key: string;
  timestamp: string;
  offset: number
}

export interface KafkaModuleOption {
  name: string;
  options: {
    client: KafkaConfig,
    consumer: ConsumerConfig,
    producer?: ProducerConfig,
    deserializer?: Deserializer,
    serializer?: Serializer,
    consumeFromBeginning?: boolean;
    seek?: Record<string, string>
  }
}

export interface KafkaMessageObject extends Message {
  value: any | Buffer | string | null;
  key: any;
}

export interface KafkaMessageSend extends Omit<ProducerRecord, 'topic'> {
  messages: KafkaMessageObject[],
  topic?: string
}
