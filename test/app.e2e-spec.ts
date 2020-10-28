import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { join } from 'path';
import AppModule from './e2e/app/config.app';
import { TestConsumer, TOPIC_NAME } from './e2e/app/test.controller';
import { SchemaRegistry, readAVSC } from "@kafkajs/confluent-schema-registry";

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
  let registry: SchemaRegistry;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestMicroservice({});
    app.enableShutdownHooks();
    await app.listenAsync();
    
    controller = await app.resolve(TestConsumer);
    registry = new SchemaRegistry({ host: 'http://localhost:8081/' })
  });

  afterAll(async() => {
    await app.close();
  });

  it("should give kafka some time", done => {
    setTimeout(done, 4000);
  });

  it('We can send schemas to schema registry', async() => {
    // For our other tests we require the schema to already exist
    // in schema registry and dont allow uploaded through the nestJS
    // application.
    const valuePath = join(__dirname, 'e2e', 'app', 'value-schema.avsc');
    const keyPath = join(__dirname, 'e2e', 'app', 'key-schema.avsc');
    const valueSchema = readAVSC(valuePath);
    const keySchema = readAVSC(keyPath);

    await registry.register(valueSchema, { separator: '-' })
    await registry.register(keySchema, { separator: '-' })
  })

  it('We can SEND and ACCEPT AVRO messages', async (done) => {
    await controller.sendMessage({ messages })
    expect(controller.messages.length).toBe(messages.length);

    expect(controller.messages[0]).toEqual(messages[0].value);
    expect(controller.messages[1]).toEqual(messages[1].value);

    done();
  });
});
