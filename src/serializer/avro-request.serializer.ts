import { Serializer } from "@nestjs/microservices";
import { Logger } from '@nestjs/common/services/logger.service';
import { SchemaRegistry } from "@kafkajs/confluent-schema-registry";
import { SchemaRegistryAPIClientArgs } from "@kafkajs/confluent-schema-registry/dist/api"
import { KafkaMessageSend, KafkaMessageObject } from "../interfaces";

type KafkaAvroRequestSerializerSchema = {
  topic: string;
  key?: string;
  value: string;
  keySuffix?: string,
  valueSuffix?:string,
}

export type KafkaAvroRequestSerializerConfig = {
  schemas: KafkaAvroRequestSerializerSchema[],
  config: SchemaRegistryAPIClientArgs;
  schemaSeparator?: string;
}

export class KafkaAvroRequestSerializer
  implements Serializer<KafkaMessageSend, Promise<KafkaMessageSend>> {

    protected registry: SchemaRegistry;
    protected logger = new Logger(KafkaAvroRequestSerializer.name);
    protected schemas = new Map();
    protected separator: string;
    protected config: KafkaAvroRequestSerializerConfig;

    constructor(options: KafkaAvroRequestSerializerConfig) {
      this.registry = new SchemaRegistry(options.config);
      this.config = options;

      this.getSchemaIds();
    }

    /**
     * Grab the schemaIds for the registry to cache for serialization.
     */
    private async getSchemaIds() {
      for await (const schema of this.config.schemas.values()) {
        const keySuffix = schema.keySuffix ?? 'key';
        const valueSuffix = schema.valueSuffix ?? 'value';

        try {
          const keyId = await this.registry.getLatestSchemaId(`${schema.topic}-${keySuffix}`) || null;
          const valueId = await this.registry.getLatestSchemaId(`${schema.topic}-${valueSuffix}`)

          this.schemas.set(schema.topic, {
            keyId,
            valueId,
            keySuffix,
            valueSuffix,
          });
        } catch (e) {
          this.logger.error('Unable to get schema ID: ', e);
        }
        
      }
    }

    async serialize(value: KafkaMessageSend): Promise<KafkaMessageSend> {
      const outgoingMessage = value;

      try {
        const schema = this.schemas.get(value.topic);
        const {keyId, valueId } = schema;

        const messages: Promise<KafkaMessageObject>[] = value.messages.map(async(origMessage) => {

          let encodedKey = origMessage.key;
          const encodedValue = await this.registry.encode(valueId, origMessage.value);

          if (keyId) {
            encodedKey = await this.registry.encode(keyId, origMessage.key);
          }
          
          return {
            ...origMessage,
            value: encodedValue,
            key: encodedKey
          };
        });

        const results = await Promise.all(messages);
        outgoingMessage.messages = results;
      } catch (e) {
        this.logger.error('Error serializing', e);
      }

      return outgoingMessage;
    }

}
