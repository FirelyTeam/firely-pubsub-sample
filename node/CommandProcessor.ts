import {
    RetrievePlanItem,
    StorePlanItem,
    StorePlanOperation
} from "./messagesV1";
import {PubSubClient} from "./PubSubClient";

export class CommandProcessor {
    private _itemId = 0
    private _pubSubClient

    constructor(pubSubClient: PubSubClient) {
        this._pubSubClient = pubSubClient
    }


    buildRetrievePlanItem(args: string[]) {
        if (args.length < 1)
            return null;
        const id = args[0];
        const vid = args.length >= 2 ? args[1] : null;

        return this._pubSubClient.createRetrievePlanItem(this._itemId++, "Patient", id, vid)
    }

    buildStorePlanItem(command: string, args: string[]): StorePlanItem | null {
        return (() => {
            switch (command) {
                case "d":
                    return this.deletePatient(args);
                case "c":
                    return this.createPatient(args);
                case "u":
                    return this.updatePatient(args, false);
                case "ups":
                    return this.updatePatient(args, true);
                default:
                    return null;
            }
        })();
    }

    async runRetrievePlan(retrievePlanItems: RetrievePlanItem[]): Promise<void> {
        await this._pubSubClient.runRetrievePlan(retrievePlanItems)
    }

    async runExecuteStorePlan(storePlanItems: StorePlanItem[]): Promise<void> {
        await this._pubSubClient.runExecuteStorePlan(storePlanItems)
    }

    private deletePatient(parameters: string[]): StorePlanItem | null {
        // Implement the logic for delete operation here
        if (parameters.length < 1)
            return null;
        const id = parameters[0];
        const vid = (parameters.length >= 2) ? parameters[1] : null;
        return this._pubSubClient.createStorePlanItem(this._itemId++, StorePlanOperation.Delete, null, "Patient", id, vid);
    }

    private createPatient(parameters: string[]): StorePlanItem | null {
        if (parameters.length < 3)
            return null;
        const family = parameters[0];
        const id = parameters[1];
        const vid = parameters[2];
        const p = this.createPatientResource(id, vid, family);

        return this._pubSubClient.createStorePlanItem(this._itemId++, StorePlanOperation.Create, p, "Patient", id);
    }

    private updatePatient(parameters: string[], upsert: boolean): StorePlanItem | null {
        if (parameters.length < 4)
            return null;
        const family = parameters[0];
        const id = parameters[1];
        const newVid = parameters[2];
        const currentVid = parameters[3];
        const p = this.createPatientResource(id, newVid, family);

        return this._pubSubClient.createStorePlanItem(this._itemId++, upsert ? StorePlanOperation.Upsert : StorePlanOperation.Update, p, "Patient", id, currentVid);
    }

    private createPatientResource(id: string, versionId: string, family: string): string {
        const patient = {
            resourceType: 'Patient',
            id: id,
            meta: {
                versionId: versionId,
                lastUpdated: new Date().toJSON().toString()
            },
            name: [
                {
                    'family': family
                }
            ]
        }
        return JSON.stringify(patient)
    }
}