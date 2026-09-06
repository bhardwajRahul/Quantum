export interface GithubAccountFields{
    userId: number;
    githubId: string;
    username: string;
    avatarUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface GithubUserProfile{
    id: number;
    login: string;
    avatar_url: string | null;
    name: string | null;
}
