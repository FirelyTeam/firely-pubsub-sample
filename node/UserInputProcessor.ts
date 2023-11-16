import readline from "readline";
import {CommandProcessor} from "./CommandProcessor";
import {RetrievePlanItem, StorePlanItem} from "./messagesV1";

export class UserInputProcessor {
    private _commandProcessor: CommandProcessor

    constructor(commandProcessor: CommandProcessor) {
        this._commandProcessor = commandProcessor
    }

    async processUserInput() {
        const storePlanItems: StorePlanItem[] = [];
        const retrievePlanItems: RetrievePlanItem[] = [];

        let stop = false;
        while (!stop) {
            console.log('Enter a command:');

            let line = await this.readLineAsync()
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
                    this.printUsage();
                    break;
                case 'r':
                    const retrievePlanItem = this._commandProcessor.buildRetrievePlanItem(args);
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
                    const storePlanItem = this._commandProcessor.buildStorePlanItem(command, args);
                    if (storePlanItem) {
                        storePlanItems.push(storePlanItem);
                        break;
                    }
                    badArguments = true;
                    break;
                default:
                    console.log('Invalid command.');
                    this.printUsage();
                    break;
            }

            if (badArguments) {
                console.log('Invalid arguments.');
                this.printUsage();
            }

            if (!continued) {
                if (retrievePlanItems.length > 0) {
                    await this._commandProcessor.runRetrievePlan(retrievePlanItems);
                    retrievePlanItems.length = 0;
                }
                if (storePlanItems.length > 0) {
                    await this._commandProcessor.runExecuteStorePlan(storePlanItems);
                    storePlanItems.length = 0;
                }
            }
        }
    }

    private async readLineAsync(): Promise<string> {
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

    private printUsage() {
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
}