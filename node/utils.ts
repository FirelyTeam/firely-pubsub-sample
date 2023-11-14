import {
    ExecuteStorePlanCommand,
    RetrievePlanCommand,
    RetrievePlanItem,
    StorePlanItem,
    StorePlanOperation
} from './messagesV1';

export function CreatePatient(id: string, versionId: string, family: string) : string {
    const patient =  {
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

export function CreateRetrievePlanItem( itemId: number, resourceType?: string | null, resourceId?: string | null, version?: string | null) : RetrievePlanItem {
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


export function CreateRetrievePlanCommand(  retrievePlanItems : Array<RetrievePlanItem>) : RetrievePlanCommand {
    return {
            instructions: retrievePlanItems
    };
}

export function CreateStorePlanItem( itemId: number, operation: StorePlanOperation, resource?: string | null, resourceType?: string | null, resourceId?: string | null, currentVersion?: string | null) : StorePlanItem {
    return {
        "itemId": itemId.toString(),
        "resource": String(resource),
        "resourceType": String(resourceType),
        "resourceId": String(resourceId),
        "currentVersion": (currentVersion == undefined) ? null : currentVersion,
        "operation":  StorePlanOperation[operation]
    };
}

export function CreateExecuteStorePlanCommand(  storePlanItems : Array<StorePlanItem>) : ExecuteStorePlanCommand {
    return {
        instructions: storePlanItems
    };
}
