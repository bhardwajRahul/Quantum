export interface ActivityReporter{
    step<T>(name: string, fn: () => Promise<T>): Promise<T>;
    progress(title: string, meta?: Record<string, any>): void;
}
