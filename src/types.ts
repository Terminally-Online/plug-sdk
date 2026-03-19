import { z } from 'zod'

export interface PlugAuthConfig {
    getAccessToken: () => Promise<string | null>
    onTokenExpired?: () => Promise<string | null>
}

export interface PlugSDKConfig {
    baseUrl: string
    timeout?: number
    retries?: number
    cache?: {
        staleTime?: number
        gcTime?: number
    }
    auth?: PlugAuthConfig
    onError?: (error: Error) => void
    onSuccess?: (data: unknown) => void
}

export type ResolvedPlugSDKConfig = Required<Omit<PlugSDKConfig, 'auth'>> & Pick<PlugSDKConfig, 'auth'>

export class PlugSDKError extends Error {
    constructor(
        message: string,
        public code: string,
        public statusCode?: number,
        public data?: unknown
    ) {
        super(message)
        this.name = 'PlugSDKError'
    }
}

export class PlugValidationError extends PlugSDKError {
    constructor(message: string, public validationErrors: z.ZodIssue[]) {
        super(message, 'VALIDATION_ERROR')
        this.name = 'PlugValidationError'
    }
}

export class PlugNetworkError extends PlugSDKError {
    constructor(message: string, statusCode?: number) {
        super(message, 'NETWORK_ERROR', statusCode)
        this.name = 'PlugNetworkError'
    }
}

export interface CacheConfig {
    protocols: {
        staleTime: number
        gcTime: number
    }
    actions: {
        staleTime: number
        gcTime: number
    }
    intents: {
        staleTime: number
        gcTime: number
    }
}
