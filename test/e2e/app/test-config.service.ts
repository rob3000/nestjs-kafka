import { Injectable } from '@nestjs/common';

@Injectable()
export class TestConfigService {
  getBroker() {
    return 'localhost:9092';
  }

  getAvroHost() {
    return 'http://localhost:8081/';
  }
}
