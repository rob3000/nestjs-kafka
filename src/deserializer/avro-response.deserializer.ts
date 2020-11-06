import { Deserializer } from "@nestjs/microservices";
import { Logger } from '@nestjs/common/services/logger.service';
import { KafkaResponse } from "../interfaces";
import { SchemaRegistry } from "@kafkajs/confluent-schema-registry";
import { SchemaRegistryAPIClientArgs } from "@kafkajs/confluent-schema-registry/dist/api"
import { KafkaResponseDeserializer } from "./kafka-response.deserializer";

export class KafkaAvroResponseDeserializer
  implements Deserializer<any, Promise<KafkaResponse>> {

    protected registry: SchemaRegistry;
    protected logger = new Logger(KafkaAvroResponseDeserializer.name);
    protected fallback: KafkaResponseDeserializer;

    constructor(config: SchemaRegistryAPIClientArgs) {
      this.registry = new SchemaRegistry(config);
      this.fallback = new KafkaResponseDeserializer()
    }

    async deserialize(message: any, options?: Record<string, any>): Promise<KafkaResponse> {
      const { value, key, timestamp, offset } = message;
      const decodeResponse = {
        response: value,
        key,
        timestamp,
        offset,
      }

      try {
        decodeResponse.key = await this.registry.decode(message.key);
        decodeResponse.response = await this.registry.decode(message.value);
      } catch (e) {
        this.logger.error(e);
        // Fall back to the normal kafka deserialize.
        const msg = this.fallback.deserialize(message);
        Object.assign(decodeResponse, msg);
      }

      return decodeResponse;
    }

}
