#serverless-paymail-eventsource

A quick and dirty example of using DynamoDB stream on `serverless-paymail` table as an event source to generate events for broadcast
to other components via an SNS topic.


> Note in the AWS Console (ui) this is referred to as a _trigger_ on the DynamoDB table

In order to deploy this `serverless-paymail` must already be deployed and you will need the ARN of the latest stream on
the PaymailResolution table.



## Deployment

```shell script
sls deploy --stage prod --STREAM_ARN <ARN_OF_DynamoDB_Table_Stream>
```
 
 You can then create any type of SNS subscription to the topic provisioned as part fo the deployment.
 
