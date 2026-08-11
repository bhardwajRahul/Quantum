export interface OwnedResolver<T>{
    getOwned(userId: number, id: number): Promise<T>;
}
