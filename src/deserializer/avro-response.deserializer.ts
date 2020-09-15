
import { Deserializer } from "@nestjs/microservices";
import { KafkaResponse } from "../interfaces";
import { SCHEMAS } from "../kafka.decorator";
import * as avro from "avsc";

export class KafkaAvroResponseDeserializer
  implements Deserializer<any, KafkaResponse> {

    deserialize(message: any, options?: Record<string, any>): KafkaResponse {
      const { topic } = options;
      const { value, id, timestamp, offset } = message;

      const schema = SCHEMAS.get(topic);

      const type = avro.Type.forSchema({
        type: "record",
        name: topic,
        fields: schema,
      });

      const messageValue = type.fromBuffer(value.slice(5));

      return {
        response: messageValue,
        id,
        timestamp,
        offset,
      }
    }

}
