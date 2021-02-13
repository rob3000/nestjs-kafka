import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import AppModule from './e2e/app/config.app.async';
import { TestConsumer } from './e2e/app/test.controller';
import { messages } from './constants';

describe('AppModule Async (e2e)', () => {
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
