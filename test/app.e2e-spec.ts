import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { join } from 'path';
import AppModule from './e2e/app/config.app';
import { TestConsumer } from './e2e/app/test.controller';
import { SchemaRegistry, readAVSC } from "@kafkajs/confluent-schema-registry";

describe('Setup for E2E', () => {
  it('We can send schemas to schema registry', async() => {
    const registry = new SchemaRegistry({ host: 'http://localhost:8081/' })

    // For our other tests we require the schema to already exist
    // in schema registry and dont allow uploaded through the nestJS
    // application.
    const valuePath = join(__dirname, 'e2e', 'app', 'value-schema.avsc');
    const keyPath = join(__dirname, 'e2e', 'app', 'key-schema.avsc');
    const valueSchema = readAVSC(valuePath);
    const keySchema = readAVSC(keyPath);

    const valueSchemaResult = await registry.register(valueSchema, { separator: '-' });
    const keySchemaResult = await registry.register(keySchema, { separator: '-' });

    expect(valueSchemaResult).toEqual({id: 1})
    expect(keySchemaResult).toEqual({id: 2})
  })
})

describe('AppModule (e2e)', () => {
  const messages = [
    {
      key: {
        id: 1
      },
      value: {
        id: 1,
        metadataId: 2,
        objectId: 3,
        firstName: 'Hello',
        lastName: 'World!',
        __table: 'test-table',
        __deleted: null,
      }
    },
    {
      key: {
        id: 2
      },
      value: {
        id: 2,
        metadataId: 3,
        objectId: 4,
        firstName: 'Foo',
        lastName: 'Bar',
        __table: 'test-table',
        __deleted: null,
      }
    },
  ];

  let app: INestMicroservice;
  let controller: TestConsumer;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestMicroservice({});
    app.enableShutdownHooks();
    await app.listenAsync();
    
    controller = await app.resolve(TestConsumer);
    controller.messages = [];
  });

  afterAll(async() => {
    await app.close();
  });

  it("should give kafka some time", done => {
    setTimeout(done, 4000);
  });

  it('We can SEND and ACCEPT AVRO messages', async () => {
    return controller.sendMessage({ messages }).then(() => {
      expect(controller.messages.length).toBe(messages.length);

      expect(controller.messages[0]).toEqual(messages[0].value);
      expect(controller.messages[1]).toEqual(messages[1].value);
    });
  });
});
