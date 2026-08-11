export interface GithubOAuthCallbackQuery{
    /** @minLength 1 */
    code?: string;
    /** @minLength 1 */
    state?: string;
}
