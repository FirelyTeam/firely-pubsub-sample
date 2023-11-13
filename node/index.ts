import {Guid} from 'guid-typescript';
import {CheckOrderStatus, OrderStatus} from './messagesV1';
import readline from 'readline';
import {MessageType} from 'masstransit-rabbitmq/dist/messageType';
import masstransit from 'masstransit-rabbitmq';

MessageType.setDefaultNamespace('Contracts');

const bus = masstransit();

/*
 * Uncomment below to handle the request inside node (stop the .NET endpoint)
 */

/*
bus.receiveEndpoint('order-status', cfg => {
    cfg.handle<CheckOrderStatus>(new MessageType('CheckOrderStatus'), async context => {

        await context.respond<OrderStatus>({orderId: context.message.orderId, status: 'Pending'}, send => {
            send.messageType = new MessageType('OrderStatus').toMessageType();
        });
    });
});
*/

let client = bus.requestClient<CheckOrderStatus, OrderStatus>({
    exchange: 'order-status',
    requestType: new MessageType('CheckOrderStatus'),
    responseType: new MessageType('OrderStatus'),
});

const checkOrderStatusInterval = setInterval(async () => {
    try {
        let response = await client.getResponse({orderId: Guid.create().toString()});

        console.log('Order', response.message.orderId, ' status: ', response.message.status);
    }
    catch (e: any) {
        console.error('order status check failed', e.message);
    }
}, 1000);

process.on('SIGINT', async () => {
    clearInterval(checkOrderStatusInterval);
});
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const start = async () => {
    for await (const line of rl) {
        if (line === 'quit')
            break;
    }
};
start()
    .then(async () => {
        await bus.stop();
        process.exit(0);
    });
