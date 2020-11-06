import { Serializer } from "@nestjs/microservices";
import { Logger } from '@nestjs/common/services/logger.service';
import { ProducerRecord } from "kafkajs";
import { SchemaRegistry, readAVSC } from "@kafkajs/confluent-schema-registry";
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

    constructor(options: KafkaAvroRequestSerializerConfig) {
      this.registry = new SchemaRegistry(options.config);
      // this.separator = options.schemaSeparator || '-';
      let keySchema = null;
      options.schemas.forEach((schema: KafkaAvroRequestSerializerSchema) => {
        if (schema.key) {
          keySchema = readAVSC(schema.key);
        }

        const valueSchema = readAVSC(schema.value);

        const schemaObject = {
          key: keySchema,
          value: valueSchema,
          keySuffix: schema.keySuffix ?? 'key',
          valueSuffix: schema.valueSuffix ?? 'value',
        }
        
        this.schemas.set(schema.topic, schemaObject);
      });

    }

    async serialize(value: KafkaMessageSend): Promise<KafkaMessageSend> {
      const outgoingMessage = value;

      try {

        const schema = this.schemas.get(value.topic);

        // @todo - need to work out a way to better get the schema based on topic.
        const keyId = await this.registry.getLatestSchemaId(`${value.topic}-${schema.keySuffix}`)
        const valueId = await this.registry.getLatestSchemaId(`${value.topic}-${schema.valueSuffix}`)

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
        this.logger.error(e);
      }

      return outgoingMessage;
    }

}
