export class KafkaParser {

  decode(value) {
    let result = value.toString();
    const startChar = result.charAt(0);
    // only try to parse objects and arrays
    if (startChar === '{' || startChar === '[') {
      try {
          result = JSON.parse(value.toString());
      }
      catch (e) { }
    }
    return result;
  }

}
