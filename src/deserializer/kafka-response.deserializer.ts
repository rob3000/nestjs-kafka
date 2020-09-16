import { Deserializer } from "@nestjs/microservices";
import { KafkaResponse } from "../interfaces";

export class KafkaResponseDeserializer
  implements Deserializer<any, KafkaResponse> {

  deserialize(message: any, options?: Record<string, any>): KafkaResponse {
    const { key, value, timestamp, offset } = message;
    let id = key;
    let response = value;

    if (Buffer.isBuffer(key)) {
      id = Buffer.from(key).toString()
    }

    if (Buffer.isBuffer(value)) {
      response = Buffer.from(value).toString()
    }

    return {
      id,
      response,
      timestamp,
      offset
    };
  }
}
