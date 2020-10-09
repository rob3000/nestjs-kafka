import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import AppModule from './e2e/app/config.app';
import { TestConsumer, TOPIC_NAME } from './e2e/app/test.controller';

describe('AppModule (e2e)', () => {
  let app: INestMicroservice;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestMicroservice({});
    app.enableShutdownHooks();
    await app.listenAsync();
  });

  afterAll(async() => {
    await app.close();
  });

  it("should give kafka some time", done => {
    setTimeout(done, 2500);
  });

  it('can produce JSON messages', async () => {
    const cont = await app.resolve(TestConsumer);

    return cont.sendMessage([{
      value: 'Hello World!',
      timestamp: Date.now().toString(),
    }]).then((value) => {
      console.log(value);
      expect(value).toBe([{
        topicName: TOPIC_NAME,
        partition: 0,
        errorCode: 0,
        baseOffset: '0',
        logAppendTime: '-1',
        logStartOffset: '0'
      }]);
    });
  });

  // it('can accept JSON message', () => {


  // });

  // it('can produce AVRO message', () => {
  // });

  // it('can accept AVRO message', () => {
  // });
});
