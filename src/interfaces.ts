import { Deserializer, Serializer } from "@nestjs/microservices";
import { ConsumerConfig, KafkaConfig, ProducerConfig } from "kafkajs";

export interface KafkaResponse<T = any> {
  response: T;
  id: string;
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
  }
}

export interface SchemaRegistryOption {
  url: string;
}
