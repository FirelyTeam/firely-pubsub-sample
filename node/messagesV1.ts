
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

export interface ExecuteStorePlan {
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
