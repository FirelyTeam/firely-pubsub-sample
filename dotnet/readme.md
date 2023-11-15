# Introduction
This directory contains a demo client displaying how to use the PubSub feature of `Firely Server`.
The client is written in `C#` running on `dotnet core`. and using the [Firely Server Contract nuget package](https://www.nuget.org/packages/Firely.Server.Contracts).

# Build 
Run the following command to build the project.
```
dotnet restore
dotnet build
```
# Usage

First you need to start the following dependencies to be able to run the client

## RabbitMQ

Create RabbitMQ with following command
```
docker run -d --name firely-broker -p 15672:15672 -p 5672:5672 rabbitmq:3-management
```
when browsing to http://localhost:15672 - management console will be opened. Default credentials are `guest/guest`

## Firely Server
Start Firely server and make sure to enable the PubSub in the settings file as described in the 
[documentation](https://docs.simplifier.net/projects/Firely-Server/en/latest/features_and_tools/pubsub.html).

## Using the client
Once RabbitMq and Firely Server are running, you can start the client using:
```
dotnet run --project Firely.Server.MessageSender
```
You then got an CLI interface where you can enter command and then get corresponding response
and notification.

Valid commands are:
```
        Quit
                q 
        Help
                ? 
        Create Patient
                c familyName patientId patientVersion
        Retrieve Patient
                r patientId patientVersion
        Update Patient
                u familyName patientId newPatientVersion currentPatientVersion
        Delete Patient
                d patientId currentPatientVersion
```
