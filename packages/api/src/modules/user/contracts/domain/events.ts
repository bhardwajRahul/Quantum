export interface UserCreatedPayload{
    userId: number;
    username: string;
    email: string;
}

export interface UserDeletedPayload{
    userId: number;
}
