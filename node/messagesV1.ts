
export interface ResourceReference {
    resourceType: string
    resourceId: string
    version?: string
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
    currentVersion?: string
    operation: StorePlanOperation
}

export interface StorePlan {
    instructions: Array<StorePlanItem>
}

export interface ExecuteStorePlanCommand {
    plan: StorePlan
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
