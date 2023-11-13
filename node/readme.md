# Introduction
This directory contains a demo client written in `typescript` and using `node.js` 
to test the PubSub feature of `Firely Server` with `RabbitMQ` as a backend.

The `MassTransit-js` contract messages are defined in `messagesV1.ts`.

Utility functions for integrations tests are in `utils.ts`.

# Build 

`Node.js` version used for building the integration tests is `v18.14.2`
To build the integrations tests open a `bash/WSL/Powershell/cmd` terminal and run following command

```
npm install
npm run build
```
# Configure/Install dependencies for Integration Tests

First you need to start the following dependencies to be able to run the integration tests

## RabbitMQ

Create RabbitMQ with following command
```
docker run -d --name firely-broker -p 15672:15672 -p 5672:5672 rabbitmq:3-management
```
when browsing to http://localhost:15672 - management console will be opened. Default credentials are `guest/guest`

## SQL server

Create SQL server with following command
```
docker run -d --name vonkdatatest -e "ACCEPT_EULA=Y" -e 'SA_PASSWORD=yourStrong(!)Password' -p 1435:1433  -h vonkdatatest mcr.microsoft.com/azure-sql-edge:latest
```

Initialize database with following steps

- Create manually a new empty database with name  for example `VonkLeanData` in SQL Server Management studio.
- Initialize the database with following 2 SQL scripts in `SQL Server Management studio` located in repository `Firely/Vonk` directory `microservices\Firely.Server.Store\src\Firely.Server.Store.Mssql.Shared\dbscripts`

1. SqlLean_Conformance.sql
2. SqlLean_Data.sql

**Important**: Change mode of query window in `SQL Server Management studio` to `SQLCMD mode` found in dropdown menu `Query`. And change the database names of `target` to your new database name and `source` to your current `Vonk data` database.

**Note**: currently the `sqlLean` scripts only support FHIR release R4.

## Firely.Server.Store

You can find `Firely.Server.Store` in repository `Firely/Vonk` directory `\microservices\Firely.Server.Store\src`

**Important**: disable `FhirRelease` check in method `Consume` of class `StorePlanConsumer` in namespace `Firely.Server.Store.MessageBus` by commenting out `FhirRelease check code`.
Currently it is not possible to send `FhirRelease` as header with `MassTransit-js` which is used by node.js integration tests.

Before running `Firely.Server.Store` make sure your `SQL server` database and `rabbitmq` eventstore are used in configuration below.

config.yaml

````yaml
AllowedHosts: "*"

MessageBus:
  BrokerType: RabbitMq
  QueueName: sync-in
  VirtualHost: /

MssqlStore:
  FhirRelease: R4

Serilog:
  MinimumLevel:
    Default: Debug
    Override:
      System: Warning
      Microsoft: Warning
  WriteTo:
  - Name: Console
````

secrets.yaml

````yaml
MssqlStore:
  MssqlConnection: "Server=localhost,1435;MultipleActiveResultSets=true;Database=VonkLeanData;User Id=sa;Password=yourStrong(!)Password;Encrypt=False"

MessageBus:
  Host: localhost
  Username: guest
  Password: guest
````

1) run in Visual studio 2022/Rider

Run the `Firely.Server.Store.Webapp` by opening solution in `\microservices\Firely.Server.Store\src\Firely.Server.Store.sln`

2) run in docker

To run `Firely.Server.Store` in docker open a `bash/WSL/Powershell/cmd` terminal and run following command while

**Important**: Make sure your relative path from root `Firely/Vonk` repository is `./microservices/Firely.Server.Store/src` in the terminal

```
docker run -d --name firely-server-store -p 7080:7080 -e "ASPNETCORE_URLS=http://0.0.0.0:7080" -v ${PWD}/Firely.Server.Store.WebApp/config.yaml:/etc/config/config.yaml -v ${PWD}/Firely.Server.Store.WebApp/secrets.yaml:/etc/secrets/secrets.yaml firely-server-store:latest
```

**Important**: Make sure you do not use **localhost** but ip address or domain name for RabbitMQ and SQL server in `secrets.yaml`.


# Run Integration Tests

After both dependencies are running, open a WSL/Powershell/cmd terminal and execute the following command
```
npm test
```

expected output
```
> firely.server.store.integration.tests@1.0.0 test
> mocha



  Firely.Server.Store Integration Tests
===== Rabbitmq starting =====
Connecting amqp://localhost/?heartbeat=60
===== Rabbitmq running =====
Connected amqp://localhost/?heartbeat=60
Queue: bus-530d65f4-d7cc-a438-4871-d53d28abf45f MessageCount: 0 ConsumerCount: 0
Receive endpoint started: bus-530d65f4-d7cc-a438-4871-d53d28abf45f ConsumerTag: amq.ctag-d_KfQW-ggiGmW3F2spFPag
    ✔ should return no errors when send valid storeplan ( create, update, upsert, delete)  (162ms)
    ✔ should return no errors when send valid storeplan ( create, update, upsert, delete, create, update, upsert, delete)  (149ms)
    ✔ should return no errors when send valid storeplan ( upsert )  (69ms)
    ✔ should return no errors when send valid storeplan ( create, upsert )  (75ms)
    ✔ should return no errors when send storeplan with delete when resource not exists (66ms)
    ✔ should return error when send storeplan with update when resource not exists (54ms)
    ✔ should return error when send storeplan with update when resource is deleted (79ms)
    ✔ should return error when send storeplan with create 2x same item (62ms)
===== Rabbitmq stopping =====
Bus stopped amqp://localhost/?heartbeat=60
===== Rabbitmq closed =====


  8 passing (782ms)
```