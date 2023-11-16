import {CommandProcessor} from "./CommandProcessor";
import {UserInputProcessor} from "./UserInputProcessor";
import {PubSubClient} from "./PubSubClient";

const busOption = {
    host: 'localhost',
    virtualHost: '/',
    port: 5672
}

const pubSubClient = new PubSubClient(busOption)
const commandProcessor = new CommandProcessor(pubSubClient)
const userInputProcessor = new UserInputProcessor(commandProcessor)

userInputProcessor.processUserInput()
    .then(async () => {
        await pubSubClient.stop();
        process.exit(0);
    });
