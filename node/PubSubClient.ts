import {RequestClient} from "masstransit-rabbitmq/dist/requestClient";
import {
    ExecuteStorePlanCommand,
    ExecuteStorePlanResponse, ResourcesChangedEvent, ResourcesChangedLightEvent,
    RetrievePlanCommand, RetrievePlanItem,
    RetrievePlanResponse, StorePlanItem, StorePlanOperation
} from "./messagesV1";
import masstransit, {Bus} from "masstransit-rabbitmq";
import {MessageType} from "masstransit-rabbitmq/dist/messageType";
import {HostSettings} from "masstransit-rabbitmq/dist/RabbitMqEndpointAddress";
import * as amqplib from 'amqplib';


export class PubSubClient {
    private _storePlanClient: RequestClient<ExecuteStorePlanCommand, ExecuteStorePlanResponse>
    private _retrievePlanClient: RequestClient<RetrievePlanCommand, RetrievePlanResponse>
    private _bus: Bus
    readonly _firelyNamespace = 'Firely.Server.Contracts.Messages.V1'

    constructor(busOption: HostSettings) {

        MessageType.setDefaultNamespace(this._firelyNamespace);

        const executeStorePlanCommandType = new MessageType('ExecuteStorePlanCommand')
        const executeStorePlanResponseType = new MessageType('ExecuteStorePlanResponse')
        const executeStorePlanExchange = `${executeStorePlanCommandType.ns}:${executeStorePlanCommandType.name}`
        const retrievePlanCommandType = new MessageType('RetrievePlanCommand')
        const retrievePlanResponseType = new MessageType('RetrievePlanResponse')
        const retrievePlanExchange = `${retrievePlanCommandType.ns}:${retrievePlanCommandType.name}`
        const resourcesChangedEventType = new MessageType('ResourcesChangedEvent')
        const resourcesChangedLightEventType = new MessageType('ResourcesChangedLightEvent')
        const resourcesChangedLightEventExchange = `${resourcesChangedLightEventType.ns}:${resourcesChangedLightEventType.name}`
        const resourcesChangedEventExchange = `${resourcesChangedEventType.ns}:${resourcesChangedEventType.name}`
        const nodeResourceChangeLightQueueName = `${resourcesChangedLightEventExchange}_node`
        const nodeResourceChangeQueueName = `${resourcesChangedEventExchange}_node`

        this._bus = masstransit(busOption)

        console.log(`Setting up a client to send ${executeStorePlanCommandType.toString()} and retrieve ${executeStorePlanResponseType.toString()}` )
        this._storePlanClient = this._bus.requestClient<ExecuteStorePlanCommand, ExecuteStorePlanResponse>({
            exchange: executeStorePlanExchange,
            requestType: executeStorePlanCommandType,
            responseType: executeStorePlanResponseType,
        });

        console.log(`Setting up a client to send ${retrievePlanCommandType.toString()} and retrieve ${retrievePlanResponseType.toString()}` )
        this._retrievePlanClient = this._bus.requestClient<RetrievePlanCommand, RetrievePlanResponse>({
            exchange: retrievePlanExchange,
            requestType: retrievePlanCommandType,
            responseType: retrievePlanResponseType,
        });

        console.log(`Setting up a queue ${nodeResourceChangeQueueName} and an exchange to get ${resourcesChangedEventType.toString()} events` )
        this._bus.receiveEndpoint(nodeResourceChangeQueueName,
            cfg => {
                cfg.handle<ResourcesChangedEvent>(resourcesChangedEventType,
                    async context => {
                        console.log('Received ResourcesChangedEvent: ' + JSON.stringify(context.message))
                    });
            });

        console.log(`Setting up a queue ${nodeResourceChangeLightQueueName} and an exchange to get ${resourcesChangedLightEventType.toString()} events` )
        this._bus.receiveEndpoint(nodeResourceChangeLightQueueName,
            cfg => {
                cfg.handle<ResourcesChangedLightEvent>(resourcesChangedLightEventType,
                    async context => {
                        console.log('Received ResourcesChangedLightEvent: ' + JSON.stringify(context.message))
                    });
            });
        // Add extra exchange and binding.
        // Alternatively, use 'c' and 'Firely.Server.Contracts.Messages.V1:ResourcesChangedLightEvent'
        // as queue name when calling bus.receiveEndpoint.
        this._bus.on('connect', async () => {
            console.log('Extra setup for RabbitMq...')
            const connection = await amqplib.connect(`amqp://${busOption.host}`);
            const channel = await connection.createChannel();
            // Following lines ensure that the exchanges used for the notification exist so that we can bind queues to them.
            // At the moment, Firely Server creates those only once a notification has to be sent, meaning that at the start,
            // they might not be present. This will change in future release.
            console.log('Ensure that exchanges used by Firely Server to publish events are present (SHOULD NOT BE REQUIRED IN THE FUTURE)...')
            console.log(`Creating RabbitMq fanout exchange '${resourcesChangedLightEventExchange}' if it does not exist yet`)
            await channel.assertExchange(resourcesChangedLightEventExchange, 'fanout', {durable: true, internal: false, autoDelete: false});
            console.log(`Creating RabbitMq fanout exchange '${resourcesChangedEventExchange}' if it does not exist yet`)
            await channel.assertExchange(resourcesChangedEventExchange, 'fanout', {durable: true, internal: false, autoDelete: false});

            console.log('Binding queues to the exchanges used by Firely Server to publish events are present...')
            console.log(`Binding the exchange '${resourcesChangedLightEventExchange}' to the exchange '${nodeResourceChangeLightQueueName}' created by MassTransit in this client:...`)
            await channel.bindExchange(nodeResourceChangeLightQueueName, resourcesChangedLightEventExchange, '')
            console.log(`Binding the exchange '${resourcesChangedEventExchange}' to the exchange '${nodeResourceChangeQueueName}' created by MassTransit in this client:...`)
            await channel.bindExchange(nodeResourceChangeQueueName, resourcesChangedEventExchange, '')
        })
    }

    async stop(): Promise<void> {
        await this._bus.stop()
    }

    async runRetrievePlan(retrievePlanItems: RetrievePlanItem[]): Promise<void> {
        try {
            const retrievePlanCommand = this.createRetrievePlanCommand(retrievePlanItems)
            console.log('Running plan ' + JSON.stringify(retrievePlanCommand));
            const responseContext = await this._retrievePlanClient.getResponse(retrievePlanCommand);

            console.log(JSON.stringify(responseContext.message));
        } catch (e) {
            console.log(e);
        }
    }

    async runExecuteStorePlan(storePlanItems: StorePlanItem[]): Promise<void> {
        try {
            const executeStorePlan = this.createExecuteStorePlanCommand(storePlanItems)
            console.log('Running plan ' + JSON.stringify(executeStorePlan));
            const responseContext = await this._storePlanClient.getResponse(executeStorePlan);

            console.log(JSON.stringify(responseContext.message));
        } catch (e) {
            console.log(e);
        }
    }

    createRetrievePlanItem(itemId: number, resourceType?: string | null, resourceId?: string | null, version?: string | null): RetrievePlanItem {
        const resourceReference = {
            "resourceType": String(resourceType),
            "resourceId": String(resourceId),
            "version": (version == undefined) ? null : version,
        }

        return {
            "itemId": itemId.toString(),
            "reference": resourceReference
        }
    }

    createStorePlanItem(itemId: number, operation: StorePlanOperation, resource?: string | null, resourceType?: string | null, resourceId?: string | null, currentVersion?: string | null): StorePlanItem {
        return {
            "itemId": itemId.toString(),
            "resource": String(resource),
            "resourceType": String(resourceType),
            "resourceId": String(resourceId),
            "currentVersion": (currentVersion == undefined) ? null : currentVersion,
            "operation": StorePlanOperation[operation]
        };
    }

    private createRetrievePlanCommand(retrievePlanItems: Array<RetrievePlanItem>): RetrievePlanCommand {
        return {
            instructions: retrievePlanItems
        };
    }

    private createExecuteStorePlanCommand(storePlanItems: Array<StorePlanItem>): ExecuteStorePlanCommand {
        return {
            instructions: storePlanItems
        };
    }

}