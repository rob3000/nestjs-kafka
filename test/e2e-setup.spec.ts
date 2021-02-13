import { join } from 'path';
import { SchemaRegistry, readAVSC } from '@kafkajs/confluent-schema-registry';

describe('Setup for E2E', () => {
  it('We can send schemas to schema registry', async () => {
    const registry = new SchemaRegistry({ host: 'http://localhost:8081/' });

    // For our other tests we require the schema to already exist
    // in schema registry and dont allow uploaded through the nestJS
    // application.
    const valuePath = join(__dirname, 'e2e', 'app', 'value-schema.avsc');
    const keyPath = join(__dirname, 'e2e', 'app', 'key-schema.avsc');
    const valueSchema = readAVSC(valuePath);
    const keySchema = readAVSC(keyPath);

    const valueSchemaResult = await registry.register(valueSchema, {
      separator: '-',
    });
    const keySchemaResult = await registry.register(keySchema, {
      separator: '-',
    });

    expect(valueSchemaResult).toEqual({ id: 1 });
    expect(keySchemaResult).toEqual({ id: 2 });
  });
});
