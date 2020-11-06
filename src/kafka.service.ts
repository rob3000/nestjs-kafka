import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Consumer, Kafka, Producer, RecordMetadata } from "kafkajs";
import { Deserializer, Serializer } from "@nestjs/microservices";
import { Logger } from "@nestjs/common/services/logger.service";
import { KafkaLogger } from "@nestjs/microservices/helpers/kafka-logger";
import { KafkaResponseDeserializer } from "./deserializer/kafka-response.deserializer";
import { KafkaRequestSerializer } from "./serializer/kafka-request.serializer";
import { KafkaModuleOption, KafkaMessageSend } from "./interfaces";

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
        groupId: this.getGroupIdSuffix(groupId),
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
      this.subscribe(topic);
    });
    this.bindAllTopicToConsumer();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  async connect(): Promise<void> {
    await this.producer.connect()
    await this.consumer.connect();
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
    await this.consumer.disconnect();
  }

  /**
   * Subscribes to the topics.
   * 
   * @param topic 
   */
  private async subscribe(topic: string): Promise<void> {
    await this.consumer.subscribe({
      topic,
      fromBeginning: this.options.consumeFromBeginning || false
    });
  }
  
  /**
   * Send/produce a message to a topic.
   * 
   * @param message 
   */
  async send(message: KafkaMessageSend): Promise<RecordMetadata[]> {
    if (!this.producer) {
      this.logger.error('There is no producer, unable to send message.')
      return;
    }

    const serializedPacket = await this.serializer.serialize(message);

    // @todo - rather than have a producerRecord, 
    // most of this can be done when we create the controller.
    return await this.producer.send(serializedPacket);
  }

  /**
   * Gets the groupId suffix for the consumer.
   * 
   * @param groupId 
   */
  public getGroupIdSuffix(groupId: string): string {
    return groupId + '-client';
  }

  /**
   * Calls the method you are subscribed to.
   * 
   * @param topic
   *  The topic to subscribe to.
   * @param instance 
   *  The class instance.
   */
  subscribeToResponseOf<T>(topic: string, instance: T): void {
    SUBSCRIBER_OBJECT_MAP.set(topic, instance);
  }

  /**
   * Sets up the serializer to encode outgoing messages.
   * 
   * @param options 
   */
  protected initializeSerializer(options: KafkaModuleOption['options']): void {
    this.serializer = (options && options.serializer) || new KafkaRequestSerializer();
  }

  /**
   * Sets up the deserializer to decode incoming messages.
   * 
   * @param options 
   */
  protected initializeDeserializer(options: KafkaModuleOption['options']): void {
    this.deserializer = (options && options.deserializer) || new KafkaResponseDeserializer();
  }

  /**
   * Runs the consumer and calls the consumers when a message arrives.
   */
  private bindAllTopicToConsumer(): void {
    this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const objectRef = SUBSCRIBER_OBJECT_MAP.get(topic);
        const callback = SUBSCRIBER_MAP.get(topic);

        try {
          const { timestamp, response, offset, key } = await this.deserializer.deserialize(message, { topic });
          await callback.apply(objectRef, [response, key, offset, timestamp, partition]);
        } catch(e) {
          this.logger.error(`Error for message ${topic}: ${e}`);
        }
      },
    });

    if (this.options.seek !== undefined) {
      Object.keys(this.options.seek).forEach((topic) => {
        this.consumer.seek({
          topic,
          partition: 0,
          offset: this.options.seek[topic]
        })
      })
    }
  }
}
