
export interface ResourceReference {
    resourceType: string
    resourceId: string
    version: string | null
}

export interface RetrievePlanItem {
    itemId: string
    reference: ResourceReference
}

export interface RetrievePlanCommand {
    instructions: Array<RetrievePlanItem>
}

export interface RetrievePlanResultItem {
    itemId?: string
    resource?: string
    status: number
    message: string
}

export interface  RetrievePlanResponse {
    Items: Array<RetrievePlanResultItem>
}

export enum StorePlanOperation {
    Create = 1,
    Update = 2,
    Upsert = 3,
    Delete = 4
}

export interface StorePlanItem {
    itemId: string
    resource: string
    resourceType?: string
    resourceId?: string
    currentVersion?: string | null
    operation: string
}

export interface ExecuteStorePlanCommand {
    instructions: Array<StorePlanItem>
}

export interface StorePlanResultItem {
    itemId: string
    status: number
    message: string
}

export interface StorePlanResult {
    errors: Array<StorePlanResultItem>
}

export interface ExecuteStorePlanResponse {
    result: StorePlanResult
}


export interface ResourceChange {
    reference: ResourceReference
    resource?:  string | null
    changeType:  string
}

export interface ResourceChangeLight {
    reference: ResourceReference
    changeType:  string
}

export interface ResourcesChangedEvent {
    changes: Array<ResourceChange>
}

export interface ResourcesChangedLightEvent {
    changes: Array<ResourceChangeLight>
}
