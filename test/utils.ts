import { SchemaRegistry, readAVSC } from '@kafkajs/confluent-schema-registry';
import { join } from 'path';

export class Utils {
    public static sleep(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    public static async schemaRegistrySetup() {
        const registry = new SchemaRegistry({ host: 'http://localhost:8081/' });

        // For our other tests we require the schema to already exist
        // in schema registry and dont allow uploaded through the nestJS
        // application.
        const valuePath = join(__dirname, 'e2e', 'app', 'value-schema.avsc');
        const keyPath = join(__dirname, 'e2e', 'app', 'key-schema.avsc');
        const valueSchema = readAVSC(valuePath);
        const keySchema = readAVSC(keyPath);

        const valueSchemaResult = await registry.register(valueSchema, {
            separator: '-'
        });
        const keySchemaResult = await registry.register(keySchema, {
            separator: '-'
        });
    }
}
