# Postman Sample

## Introduction
This directory contains a [postman collection](https://www.postman.com/) displaying how to use the PubSub feature of `Firely Server`.

## Usage

First you need to start the following dependencies to be able to run the postman collection.

### RabbitMQ

Create RabbitMQ with following command
```
docker run -d --name firely-broker -p 15672:15672 -p 5672:5672 rabbitmq:3-management
```
when browsing to http://localhost:15672 - management console will be opened. Default credentials are `guest/guest`

### Firely Server
Start Firely server and make sure to enable the PubSub in the settings file as described in the 
[documentation](https://docs.simplifier.net/projects/Firely-Server/en/latest/features_and_tools/pubsub.html).

### Using the collection
Once RabbitMq and Firely Server are running, you can start using the collection.

First import the [collection](./PubSub_sample.postman_collection.json) into [postman](https://www.postman.com/).

The folder `Setup` in the collection contains the requests to setup the infrastructure to setup RabbitMq exchanges and queues in order to retrieve 
replies to the command requests as well as to retrieve the notifications.

In order to collect replies corresponding to command requests, the client has to create a RabbitMq exchange and a queue, and bind the queue to the exchange.
When sending the request, it can then specify the exchange where the reply from Firely Server should be send.

For the notifications, the client has to create a RabbitMq queue, and bind the queue to the exchange
 that is used by Firely Server when posting notification, namely, `Firely.Server.Contracts.Messages.V1:ResourcesChangedLightEvent`
 and `Firely.Server.Contracts.Messages.V1:ResourcesChangedEvent`. It is important to note however that 
 currently, Firely Server does not create the exchange directly but only when the first notification is triggered (through 
 a Create, Update or Delete on a resource). This means that until this is first notification is created, you cannot bind the queue(s) to the exchange(s). 

Once the setup is done, you can send the different commands in the `Tests` folder of the collection. 
The name of the requests are explicit regarding the actions.
Note that if you want to run the command multiple times, you need to update the version of the FHIR patient resource in the requests (by default, set to `v1`).
