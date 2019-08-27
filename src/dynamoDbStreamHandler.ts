import ajv from "ajv";
import AWS from "aws-sdk";
import { ClientConfiguration, PublishInput } from "aws-sdk/clients/sns";
import * as Logger from "bunyan";
import { ERecordType } from "./ERecordType";
import { IAddressIssuedEvent } from "./IAddressIssuedEvent";
import { IEvent } from "./IEvent";

const LOG = Logger.createLogger({
  name: "dynamoDbStreamHandler",
  level: process.env.LOG_LEVEL as Logger.LogLevel,
  serializers: {
    err: Logger.stdSerializers.err,
  },
});

// @ts-ignore
const AJV = new ajv();

const snsOptions: ClientConfiguration = {
  apiVersion: "2010-03-31",

};

if (process.env.IS_OFFLINE) {
  snsOptions.endpoint = "http://127.0.0.1:4002";
}


/**
 * Publish event to topic
 *
 * @param dispatchEvent
 */
const publish = async (dispatchEvent: IEvent) => {
  const sns = new AWS.SNS(snsOptions);
  const input: PublishInput = {
    Subject: dispatchEvent.eventName,
    Message: JSON.stringify(dispatchEvent),
    TopicArn: process.env.TOPIC_ARN,
  };
  try {
    await sns.publish(input).promise();
    LOG.debug({ input }, "Message published to topic");
  } catch (err) {
    LOG.warn({ err, input }, "Error publishing to SNS topic");
  }
  return;
};


const addressIssuedEvent = (record: any): IAddressIssuedEvent | null => {
  const newImage: AWS.DynamoDB.AttributeMap = record.dynamodb.NewImage;
  const unmarshalled = AWS.DynamoDB.Converter.unmarshall(newImage);

  const event: IAddressIssuedEvent = {
    eventName: "AddressIssuedEvent",
    eventVersion: "1",
    eventId: record.eventID,
    eventTime: new Date(record.dynamodb.ApproximateCreationDateTime),
    paymailHandle: unmarshalled.paymailHandle,
    idPubKey: unmarshalled.idPubKey,
    xPubKey: unmarshalled.xPubKey,
    derivationBase: unmarshalled.derivationBase,
    addressIndex: unmarshalled.addressIndex,
    issuedAt: new Date(unmarshalled.issuedAt),
    issuedTo: unmarshalled.issuedTo,
    amount: unmarshalled.amount,
    purpose: unmarshalled.purpose,
  };

  return event;

};


const matchRecordType = (record: any) => {
  if (record.eventName === "INSERT" && (record.dynamodb && record.dynamodb.Keys.partitionKey.S.startsWith("IssuedAddress::"))) {
    return ERecordType.InsertIssuedAddress;
  } else {
    return ERecordType.Unknown;
  }
};


export const handle = async (event, context) => {
  for (const record of event.Records) {
    try {
      const recordType = matchRecordType(record);
      let dispatchEvent;
      switch (recordType) {
        case ERecordType.InsertIssuedAddress:
          dispatchEvent = addressIssuedEvent(record);
          break;
        default:

      }

      if (dispatchEvent) {
        await publish(dispatchEvent);
      } else {
        LOG.debug({ record, recordType, event }, "No event for type");
      }
    } catch (err) {
      LOG.error({ err, record, event }, "Unexpected Error dispatching event from record source");
    }
  }
  return;
};

