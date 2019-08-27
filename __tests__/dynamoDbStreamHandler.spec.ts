import AddressIssuedEventJsonSchema from "@brightnet/serverless-paymail-eventschemas";
import ajv from "ajv";
import context from "aws-lambda-mock-context";

import * as AWSMock from "aws-sdk-mock";

import { handle } from "../src/dynamoDbStreamHandler";

/** Spies for log methods **/
const spyLogInfo = jest.spyOn(require("bunyan").prototype, "info");
const spyLogWarn = jest.spyOn(require("bunyan").prototype, "warn");
const spyLogError = jest.spyOn(require("bunyan").prototype, "error");
const spyLogDebug = jest.spyOn(require("bunyan").prototype, "debug");

beforeEach(() => {
  process.env.LOG_LEVEL = "debug";
});

afterEach(() => {
  jest.clearAllMocks();
  AWSMock.restore();
});

describe("can compile external event schemas", () => {
  // Note - These aren't really unit testest for this function, however they are useful to short circuiting issues
  // with the imported json schemas
  test("it can compile AddressIssuedEvent JSON schema", () => {
    const AJV = new ajv();
    AJV.compile(AddressIssuedEventJsonSchema);
  });
});

const validInsertRecord = {
  eventName: "INSERT",
  eventId: "eventId",
  dynamodb: {
    ApproximateCreationDateTime: new Date().getTime(),
    Keys: {
      partitionKey: {
        S: "IssuedAddress::",
      },
      rangeKey: {
        N: 1,
      },
    },
    NewImage: {
      paymailHandle: {
        S: "handle@example.com",
      },
      idPubKey: {
        S: "idPubKey",
      },
      xPubKey: {
        S: "xPubKey",
      },
      derivationBase: {
        S: "derivationBase",
      },
      addressIndex: {
        N: 1,
      },
      issuedAt: {
        S: new Date().toISOString(),
      },
      issuedTo: {
        S: "handle@example.com",
      },

    },
  },
};

const unknownStreamEvent = {
  eventName: "whatever",
};

describe("Publishes AddressIssuedEvents", () => {
  test("should publish a valid AddressIssuedEvent", async () => {

    const publishSpy = jest.fn().mockImplementation().mockResolvedValue({
      MessageId: "messageId",
    });
    AWSMock.mock("SNS", "publish", publishSpy);


    const ctx = context();
    const evt = {
      Records: [
        validInsertRecord,
      ],
    };

    const response = await handle(evt, ctx);

    expect(publishSpy).toBeCalledTimes(1);
    const call = publishSpy.mock.calls[0][0];
    expect(call.Subject).toEqual("AddressIssuedEvent");
    const message = call.Message;
    const dispatchedEvent = JSON.parse(message);
    const AJV = new ajv();
    const validator = AJV.compile(AddressIssuedEventJsonSchema);
    expect(validator(dispatchedEvent)).toBeTruthy();


  });

  test("should ignore unknown records", async () => {
    const publishSpy = jest.fn().mockImplementation().mockResolvedValue({
      MessageId: "messageId",
    });

    AWSMock.mock("SNS", "publish", publishSpy);


    const ctx = context();
    const evt = {
      Records: [
        validInsertRecord,
        unknownStreamEvent,
        validInsertRecord,
      ],
    };

    const response = await handle(evt, ctx);

    expect(publishSpy).toBeCalledTimes(2);
    expect(spyLogDebug).toHaveBeenNthCalledWith(1, expect.anything(), "Message published to topic");
    expect(spyLogDebug).toHaveBeenNthCalledWith(2, expect.anything(), "No event for type");
    expect(spyLogDebug).toHaveBeenNthCalledWith(3, expect.anything(), "Message published to topic");


  });
});

