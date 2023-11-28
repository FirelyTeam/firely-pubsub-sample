# Firely Server - PubSub sample code

This repo contains 2 clients displaying how to interact with the [PubSub](https://docs.simplifier.net/projects/Firely-Server/en/latest/features_and_tools/pubsub.html) feature of [Firely Server](https://fire.ly/products/firely-server/)

The `dotnet` folder contains one [client is written in C#](dotnet/readme.md) and the `node` folder contains one [client written in `typescript`](node/readme.md) and running with `node.js`.

In addition, we also provide a [postman collection](postman/readme.md) which gives details on each messages as well as how to setup the infrastructure required for the client side when not using MassTransit.

From an abstraction level, the dotnet client provides the highest level of attraction, the [Firely Server Contract nuget package](https://www.nuget.org/packages/Firely.Server.Contracts) providing a high-level client with methods for 
posting messages and classes for the supported messages.

The node js client uses the masstransit-JS package which support adding consumers but it is the respponsibility of the client to define the expected type.

Finally, the postman collection provides the http requests that are used to setup the client side infrastructure and post commands.
In addition to the postman collection, we also provide examples of messages in the `message-example` folder.


