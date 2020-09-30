import { Deserializer } from "@nestjs/microservices";
import { Logger } from '@nestjs/common/services/logger.service';
import { KafkaResponse } from "../interfaces";
import { SchemaRegistry } from "@kafkajs/confluent-schema-registry";
import { SchemaRegistryAPIClientArgs } from "@kafkajs/confluent-schema-registry/dist/api"

export class KafkaAvroResponseDeserializer
  implements Deserializer<any, Promise<KafkaResponse>> {

    protected registry: SchemaRegistry;
    protected logger = new Logger(KafkaAvroResponseDeserializer.name);

    constructor(config: SchemaRegistryAPIClientArgs) {
      this.registry = new SchemaRegistry(config);
    }

    async deserialize(message: any, options?: Record<string, any>): Promise<KafkaResponse> {
      const { value, id, timestamp, offset } = message;

      const decodeResponse = {
        response: value,
        id,
        timestamp,
        offset,
      }

      try {
        decodeResponse.id = await this.registry.decode(message.key);
        decodeResponse.response = await this.registry.decode(message.value);
      } catch (e) {
        this.logger.error(e);
      }

      return decodeResponse;
    }

}
