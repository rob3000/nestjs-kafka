import { Deserializer } from "@nestjs/microservices";
import { Logger } from '@nestjs/common/services/logger.service';
import { KafkaResponse } from "../interfaces";
import { SCHEMAS } from "../kafka.decorator";
import * as avro from "avsc";

export class KafkaAvroResponseDeserializer
  implements Deserializer<any, KafkaResponse> {

    protected logger = new Logger(KafkaAvroResponseDeserializer.name);

    deserialize(message: any, options?: Record<string, any>): KafkaResponse {
      const { topic } = options;
      const { value, id, timestamp, offset } = message;
      const schema = SCHEMAS.get(topic);

      const decodeResponse = {
        response: value,
        id,
        timestamp,
        offset,
      }

      if (!schema) {
        this.logger.error(`Unable to find schema for: ${topic}`);
        return decodeResponse;
      }

      const type = avro.Type.forSchema({
        type: "record",
        name: topic,
        fields: schema,
      });
      
      if (value && Buffer.isBuffer(value)) {
        decodeResponse.response = type.fromBuffer(value.slice(5));
      }

      return decodeResponse;
    }

}
