export interface CheckEmailInput{
    /** @format email */
    email: string;
}

export interface CheckEmailQuery{
    email?: string;
}

export interface SignInInput{
    /** @format email */
    email: string;
    /** @minLength 1 */
    password: string;
}

export interface SignUpInput{
    /**
     * @minLength 8
     * @maxLength 16
     */
    username: string;
    /**
     * @minLength 8
     * @maxLength 32
     */
    fullname: string;
    /** @format email */
    email: string;
    /**
     * @minLength 8
     * @maxLength 16
     */
    password: string;
    /**
     * @minLength 8
     * @maxLength 16
     */
    passwordConfirm: string;
}

export interface UpdatePasswordInput{
    /** @minLength 1 */
    passwordCurrent: string;
    /**
     * @minLength 8
     * @maxLength 16
     */
    password: string;
    /**
     * @minLength 8
     * @maxLength 16
     */
    passwordConfirm: string;
}
