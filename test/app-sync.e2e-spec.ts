import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import AppModule from './e2e/app/config.app.sync';
import { TestConsumer } from './e2e/app/test.controller';
import { messages } from './constants';
import { Utils } from './utils';

describe('AppModule Sync (e2e)', () => {
    let app: INestMicroservice;
    let controller: TestConsumer;

    beforeAll(async () => {
        jest.setTimeout(10000);

        await Utils.schemaRegistrySetup();

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule]
        }).compile();

        app = moduleFixture.createNestMicroservice({});
        app.enableShutdownHooks();
        await app.listenAsync();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(async () => {
        await Utils.sleep(2000);

        controller = await app.resolve(TestConsumer);
        controller.messages = [];
    });

    it('We can SEND and ACCEPT AVRO messages', async () => {
        await Utils.sleep(2000);

        await controller.sendMessage({ messages });

        let count = 0;
        while (controller.messages.length < messages.length && count < 4) {
            await Utils.sleep(1000);
            count++;
        }

        expect(controller.messages.length).toBe(messages.length);
        expect(controller.messages.find((x) => x.id == messages[0].value.id)).toBeDefined();
        expect(controller.messages.find((x) => x.id == messages[1].value.id)).toBeDefined();
    });
});
