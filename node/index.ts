import {
    ExecuteStorePlanCommand,
    ExecuteStorePlanResponse, RetrievePlanCommand,
    RetrievePlanItem, RetrievePlanResponse,
    StorePlanItem,
    StorePlanOperation
} from './messagesV1';
import readline from 'readline';
import {MessageType} from 'masstransit-rabbitmq/dist/messageType';
import masstransit from 'masstransit-rabbitmq';
import {
    CreateExecuteStorePlanCommand,
    CreatePatient,
    CreateRetrievePlanCommand,
    CreateRetrievePlanItem,
    CreateStorePlanItem
} from './utils';

MessageType.setDefaultNamespace('Firely.Server.Contracts.Messages.V1');

const bus = masstransit();

let storePlanClient = bus.requestClient<ExecuteStorePlanCommand, ExecuteStorePlanResponse>({
    exchange: 'Firely.Server.Contracts.Messages.V1:ExecuteStorePlanCommand',
    requestType: new MessageType('ExecuteStorePlanCommand'),
    responseType: new MessageType('ExecuteStorePlanResponse'),
});

let retrievePlanClient = bus.requestClient<RetrievePlanCommand, RetrievePlanResponse>({
    exchange: 'Firely.Server.Contracts.Messages.V1:RetrievePlanCommand',
    requestType: new MessageType('RetrievePlanCommand'),
    responseType: new MessageType('RetrievePlanResponse'),
});

let itemId = 0;

function printUsage(){
        console.log("Valid commands are:");
        console.log("\tQuit");
        console.log("\t\tq ");
        console.log("\tHelp");
        console.log("\t\t? ");
        console.log("\tCreate Patient");
        console.log("\t\tc familyName patientId patientVersion");
        console.log("\tRetrieve Patient");
        console.log("\t\tr patientId patientVersion");
        console.log("\tUpdate Patient");
        console.log("\t\tu familyName patientId newPatientVersion currentPatientVersion");
        console.log("\tDelete Patient");
        console.log("\t\td patientId currentPatientVersion");
}


async function readLineAsync(): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question('', (line) => {
            rl.close();
            resolve(line);
        });
    });
}


const processUserInput = async () => {
    const storePlanItems: StorePlanItem[] = [];
    const retrievePlanItems: RetrievePlanItem[] = [];

    let stop = false;
    while (!stop) {
        console.log('Enter a command:');

        let line = await readLineAsync()
        const continued = line.endsWith(';');
        if (continued)
            line = line.slice(0, -1)
        const inputParts = line.split(' ');
        const command = inputParts[0];
        const args = inputParts.slice(1);
        let badArguments = false;
        switch (command) {
            case 'q':
                console.log('Exiting...');
                stop = true;
                break;
            case '?':
                printUsage();
                break;
            case 'r':
                const retrievePlanItem = buildRetrievePlanItem(args);
                if (retrievePlanItem) {
                    retrievePlanItems.push(retrievePlanItem);
                    break;
                }
                badArguments = true;
                break;
            case 'd':
            case 'c':
            case 'u':
            case 'ups':
                const storePlanItem = buildStorePlanItem(command, args);
                if (storePlanItem) {
                    storePlanItems.push(storePlanItem);
                    break;
                }
                badArguments = true;
                break;
            default:
                console.log('Invalid command.');
                printUsage();
                break;
        }

        if (badArguments) {
            console.log('Invalid arguments.');
            printUsage();
        }

        if (!continued) {
            if (retrievePlanItems.length > 0) {
                await runRetrievePlan(retrievePlanItems);
                retrievePlanItems.length = 0;
            }
            if (storePlanItems.length > 0) {
                await runExecuteStorePlan(storePlanItems);
                storePlanItems.length = 0;
            }
        }
    }
}

async function runRetrievePlan(retrievePlanItems: RetrievePlanItem[]): Promise<void> {
    try {
        const retrievePlanCommand = CreateRetrievePlanCommand(retrievePlanItems)
        console.log('Running plan ' + JSON.stringify(retrievePlanCommand));
        const retrievePlanResponse = await retrievePlanClient.getResponse(retrievePlanCommand);

        console.log(retrievePlanResponse.toString());
    } catch (e) {
        console.log(e);
    }
}

async function runExecuteStorePlan(storePlanItems: StorePlanItem[]): Promise<void> {
    try {
        const executeStorePlan = CreateExecuteStorePlanCommand(storePlanItems)
        console.log('Running plan ' + JSON.stringify(executeStorePlan));
        const storePlanResponse = await storePlanClient.getResponse(executeStorePlan);

        console.log(storePlanResponse.toString());
    } catch (e) {
        console.log(e);
    }
}

function buildRetrievePlanItem(args: string[])
{
    if (args.length < 2)
        return null;
    const id = args[0];
    const vid = args[1];

    return CreateRetrievePlanItem(itemId++, "Patient", id, vid)
}

function buildStorePlanItem(command: string, args: string[]): StorePlanItem | null {
    return (() => {
        switch (command) {
            case "d":
                return deletePatient(args);
            case "c":
                return createPatient(args);
            case "u":
                return updatePatient(args, false);
            case "ups":
                return updatePatient(args, true);
            default:
                return null;
        }
    })();
}

// Define the functions for Delete, Create, and Update operations
function deletePatient(parameters: string[]): StorePlanItem | null {
    // Implement the logic for delete operation here
    if (parameters.length < 2)
        return null;
    const id = parameters[0];
    const vid = parameters[1];
    return CreateStorePlanItem(itemId++, StorePlanOperation.Delete, null, "Patient", id, vid);
}

function createPatient(parameters: string[]): StorePlanItem | null
{
    if (parameters.length < 3)
        return null;
    const family = parameters[0];
    const id = parameters[1];
    const vid = parameters[2];
    const p = CreatePatient(id, vid, family);

    return CreateStorePlanItem(itemId++, StorePlanOperation.Create, p, "Patient", id);
}

function updatePatient(parameters: string[], upsert: boolean): StorePlanItem | null
{
    if (parameters.length < 4)
        return null;
    const family = parameters[0];
    const id = parameters[1];
    const newVid = parameters[2];
    const currentVid = parameters[3];
    const p = CreatePatient(id, newVid, family);

    return CreateStorePlanItem(itemId++, upsert ? StorePlanOperation.Upsert : StorePlanOperation.Update, p, "Patient", id, currentVid);
}

processUserInput()
    .then(async () => {
        await bus.stop();
        process.exit(0);
    });
