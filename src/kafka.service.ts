import { Injectable, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common';
import { Consumer, Kafka, Producer, ProducerRecord, Message } from 'kafkajs';
import { Deserializer, Serializer } from "@nestjs/microservices";
import { Logger } from '@nestjs/common/services/logger.service';
import { KafkaLogger } from '@nestjs/microservices/helpers/kafka-logger';
import { KafkaResponseDeserializer } from "./deserializer/kafka-response.deserializer";
import { KafkaRequestSerializer } from "./serializer/kafka-request.serializer";
import { KafkaModuleOption } from "./interfaces";
import { SchemaRegistryService } from "./schema-registry.service";

import {
  SUBSCRIBER_MAP,
  SUBSCRIBER_OBJECT_MAP
} from './kafka.decorator';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {

  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;
  private deserializer: Deserializer;
  private serializer: Serializer;
  private options: KafkaModuleOption['options'];
  
  protected logger = new Logger(KafkaService.name);

  constructor(
    options: KafkaModuleOption['options']
  ) {
    const { 
      client,
      consumer: consumerConfig,
      producer: producerConfig
    } = options;

    this.kafka = new Kafka({
      ...client,
      logCreator: KafkaLogger.bind(null, this.logger)
    });

    const { groupId } = consumerConfig;
    const consumerOptions = Object.assign(
      {
        groupId: groupId + '-client',
      },
      consumerConfig
    );

    this.consumer = this.kafka.consumer(consumerOptions);
    this.producer = this.kafka.producer(producerConfig);

    this.initializeDeserializer(options);
    this.initializeSerializer(options);
    this.options = options;
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
    SUBSCRIBER_MAP.forEach((functionRef, topic) => {
      this.bindAllTopicToConsumer(functionRef, topic);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  async connect() {
    await this.producer.connect()
    await this.consumer.connect();
  }

  async disconnect() {
    await this.producer.disconnect();
    await this.consumer.disconnect();
  }
  
  async send(message: ProducerRecord) {
    if (!this.producer) {
      this.logger.error('There is no producer, unable to send message.')
      return;
    }

    message.messages = message.messages.map((messageValue) => this.serializer.serialize(messageValue))

    // @todo - rather than have a producerRecord, 
    // most of this can be done when we create the controller.
    return this.producer.send(message);
  }

  /**
   * Calls the method you are subscribed to.
   * 
   * @param topic
   *  The topic to subscribe to.
   * @param instance 
   *  The class instance.
   */
  subscribeToResponseOf(topic: string, instance: object) {
    SUBSCRIBER_OBJECT_MAP.set(topic, instance);
  }

  protected initializeSerializer(options) {
    this.serializer = (options && options.serializer) || new KafkaRequestSerializer();
  }

  protected initializeDeserializer(options) {
    this.deserializer = (options && options.deserializer) || new KafkaResponseDeserializer();
  }

  private async bindAllTopicToConsumer(callback, _topic) {
    await this.consumer.subscribe({ topic: _topic, fromBeginning: this.options.consumeFromBeginning || false });
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const objectRef = SUBSCRIBER_OBJECT_MAP.get(topic);

        const { timestamp, response, offset, id } = this.deserializer.deserialize(message, { topic });

        await callback.apply(objectRef, [response, id, offset, timestamp, partition]);
      },
    });
  }
}
