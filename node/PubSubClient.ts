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


export class PubSubClient
{
    private _storePlanClient: RequestClient<ExecuteStorePlanCommand, ExecuteStorePlanResponse>
    private _retrievePlanClient: RequestClient<RetrievePlanCommand, RetrievePlanResponse>
    private _bus : Bus
    private _resourcesChangedEventType = new MessageType('ResourcesChangedEvent')
    private _resourcesChangedLightEventType = new MessageType('ResourcesChangedLightEvent')
    private _nodeResourceChangeQueueName = 'node-resource-change'
    private _nodeResourceChangeLightQueueName = 'node-resource-change-light'
    private _firelyNamespace = 'Firely.Server.Contracts.Messages.V1'

    constructor(busOption: HostSettings) {

        MessageType.setDefaultNamespace(this._firelyNamespace);

        this._bus = masstransit(busOption)
        this._storePlanClient = this._bus.requestClient<ExecuteStorePlanCommand, ExecuteStorePlanResponse>({
            exchange: 'Firely.Server.Contracts.Messages.V1:ExecuteStorePlanCommand',
            requestType: new MessageType('ExecuteStorePlanCommand'),
            responseType: new MessageType('ExecuteStorePlanResponse'),
        });

        this._retrievePlanClient = this._bus.requestClient<RetrievePlanCommand, RetrievePlanResponse>({
            exchange: 'Firely.Server.Contracts.Messages.V1:RetrievePlanCommand',
            requestType: new MessageType('RetrievePlanCommand'),
            responseType: new MessageType('RetrievePlanResponse'),
        });
        this._bus.receiveEndpoint(this._nodeResourceChangeQueueName,
            cfg => {
                cfg.handle<ResourcesChangedEvent>(this._resourcesChangedEventType,
                    async context => {
                        console.log('Received ResourcesChangedEvent: ' + JSON.stringify(context.message))
                    });
            });

        this._bus.receiveEndpoint(this._nodeResourceChangeLightQueueName,
            cfg => {
                cfg.handle<ResourcesChangedLightEvent>(this._resourcesChangedLightEventType,
                    async context => {
                        console.log('Received ResourcesChangedLightEvent: ' + JSON.stringify(context.message))
                    });
            });
        // Add extra exchange and binding.
        // Alternatively, use 'c' and 'Firely.Server.Contracts.Messages.V1:ResourcesChangedLightEvent'
        // as queue name when calling bus.receiveEndpoint.
        this._bus.on('connect', async () => {
            console.log('Extra setup for RabbitMq...')
            console.log('Ensure that exchanges used by Firely Server to publish events are present ...')
            const connection = await amqplib.connect(`amqp://${busOption.host}`);
            const channel = await connection.createChannel();
            const resourcesChangedLightEventExchange = `${this._resourcesChangedLightEventType.ns}:${this._resourcesChangedLightEventType.name}`
            await channel.assertExchange(resourcesChangedLightEventExchange, 'fanout', {durable: true, internal: false, autoDelete: false});
            const resourcesChangedEventExchange = `${this._resourcesChangedEventType.ns}:${this._resourcesChangedEventType.name}`
            await channel.assertExchange(resourcesChangedEventExchange, 'fanout', {durable: true, internal: false, autoDelete: false});
            console.log('Bind the exchanges used by Firely Server to the exchange created by MassTransit in this client...')
            await channel.bindExchange(this._nodeResourceChangeLightQueueName, resourcesChangedLightEventExchange, '')
            await channel.bindExchange(this._nodeResourceChangeQueueName, resourcesChangedEventExchange, '')
        })
    }

    async stop() : Promise<void>
    {
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