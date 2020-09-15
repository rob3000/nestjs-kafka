export const SUBSCRIBER_MAP = new Map();
export const SUBSCRIBER_OBJECT_MAP = new Map();
export const SCHEMA_TOPICS = new Map();
export const SCHEMAS = new Map();

export function SubscribeTo(topic: string) {
  return (target, propertyKey, descriptor) => {
    const originalMethod = target[propertyKey];
    SUBSCRIBER_MAP.set(topic, originalMethod);
    return descriptor;
  };
}

export function AvroSchema(topic: string, version?: number) {
  return (target, propertyKey, descriptor) => {
    SCHEMA_TOPICS.set(topic, version);
    return descriptor;
  };
}
