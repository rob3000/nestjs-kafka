import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {
  Consumer,
  Kafka,
  Producer,
  RecordMetadata,
  Admin,
  SeekEntry,
  TopicPartitionOffsetAndMetadata,
  Offsets,
} from 'kafkajs';
import { Deserializer, Serializer } from "@nestjs/microservices";
import { Logger } from "@nestjs/common/services/logger.service";
import { KafkaLogger } from "@nestjs/microservices/helpers/kafka-logger";
import { KafkaResponseDeserializer } from "./deserializer/kafka-response.deserializer";
import { KafkaRequestSerializer } from "./serializer/kafka-request.serializer";
import { KafkaModuleOption, KafkaMessageSend, KafkaTransaction } from './interfaces';

import {
  SUBSCRIBER_MAP,
  SUBSCRIBER_OBJECT_MAP
} from './kafka.decorator';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {

  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;
  private admin: Admin;
  private deserializer: Deserializer;
  private serializer: Serializer;
  private autoConnect: boolean;
  private options: KafkaModuleOption['options'];

  protected topicOffsets: Map<string, (SeekEntry & { high: string; low: string })[]> = new Map();

  protected logger = new Logger(KafkaService.name);

  constructor(
    options: KafkaModuleOption['options']
  ) {
    const {
      client,
      consumer: consumerConfig,
      producer: producerConfig,
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

    this.autoConnect = options.autoConnect ?? true;
    this.consumer = this.kafka.consumer(consumerOptions);
    this.producer = this.kafka.producer(producerConfig);
    this.admin = this.kafka.admin();

    this.initializeDeserializer(options);
    this.initializeSerializer(options);
    this.options = options;
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
    await this.getTopicOffsets();
    SUBSCRIBER_MAP.forEach((functionRef, topic) => {
      this.subscribe(topic);
    });
    this.bindAllTopicToConsumer();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  /**
   * Connect the kafka service.
   */
  async connect(): Promise<void> {
    if (!this.autoConnect) {
      return;
    }

    await this.producer.connect()
    await this.consumer.connect();
    await this.admin.connect();
  }

  /**
   * Disconnects the kafka service.
   */
  async disconnect(): Promise<void> {
    await this.producer.disconnect();
    await this.consumer.disconnect();
    await this.admin.disconnect();
  }

  /**
   * Gets the high, low and partitions of a topic.
   */
  private async getTopicOffsets(): Promise<void> {
    const topics = SUBSCRIBER_MAP.keys();

    for await (const topic of topics) {
      try {
        const topicOffsets = await this.admin.fetchTopicOffsets(topic);
        this.topicOffsets.set(topic, topicOffsets);
      } catch (e) {
        this.logger.error('Error fetching topic offset: ', topic);
      }
    }
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
   * Returns a new producer transaction in order to produce messages and commit offsets together
   */
  async transaction(): Promise<KafkaTransaction> {
    const producer = this.producer;
    if (!producer) {
      const msg = 'There is no producer, unable to start transactions.';
      this.logger.error(msg);
      throw msg;
    }

    const tx = await producer.transaction();
    const retval: KafkaTransaction = {
      abort(): Promise<void> {
        return tx.abort();
      },
      commit(): Promise<void> {
        return tx.commit();
      },
      isActive(): boolean {
        return tx.isActive();
      },
      async send(message: KafkaMessageSend): Promise<RecordMetadata[]> {
        const serializedPacket = await this.serializer.serialize(message);
        return await tx.send(serializedPacket);
      },
      sendOffsets(offsets: Offsets & { consumerGroupId: string }): Promise<void> {
        return tx.sendOffsets(offsets);
      },
    };
    return retval;
  }

  /**
   * Commit consumer offsets manually.
   * Please note that in most cases you will want to use the given __autoCommitThreshold__
   * or use a transaction to atomically set offsets and outgoing messages.
   *
   * @param topicPartitions
   */
  async commitOffsets(topicPartitions: Array<TopicPartitionOffsetAndMetadata>): Promise<void> {
    return this.consumer.commitOffsets(topicPartitions);
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
    const runConfig = (this.options.consumerRunConfig) ? this.options.consumerRunConfig : {};
    this.consumer.run({
      ...runConfig,
      eachMessage: async ({ topic, partition, message }) => {
        const objectRef = SUBSCRIBER_OBJECT_MAP.get(topic);
        const callback = SUBSCRIBER_MAP.get(topic);

        try {
          const { timestamp, response, offset, key } = await this.deserializer.deserialize(message, { topic });
          await callback.apply(objectRef, [response, key, offset, timestamp, partition]);
        } catch(e) {
          this.logger.error(`Error for message ${topic}: ${e}`);

          // Log and throw to ensure we don't keep processing the messages when there is an error.
          throw e;
        }
      },
    });

    if (this.options.seek !== undefined) {
      this.seekTopics();
    }
  }

  /**
   * Seeks to a specific offset defined in the config
   * or to the lowest value and across all partitions.
   */
  private seekTopics(): void {
    Object.keys(this.options.seek).forEach((topic) => {
      const topicOffsets = this.topicOffsets.get(topic);
      const seekPoint = this.options.seek[topic];

      topicOffsets.forEach((topicOffset) => {
        let seek = String(seekPoint);

        // Seek by timestamp
        if (typeof seekPoint == 'object') {
          const time = seekPoint as Date;
          seek = time.getTime().toString();
        }

        // Seek to the earliest timestamp.
        if (seekPoint === 'earliest') {
          seek = topicOffset.low;
        }

        this.consumer.seek({
          topic,
          partition: topicOffset.partition,
          offset: seek
        });
      })
    })
  }
}
