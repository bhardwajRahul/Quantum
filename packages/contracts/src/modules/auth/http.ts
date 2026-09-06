export interface CheckEmailInput{
    email: string;
}

export interface CheckEmailQuery{
    email?: string;
}

export interface SignInInput{
    email: string;
    password: string;
}

export interface SignUpInput{
    username: string;
    fullname: string;
    email: string;
    password: string;
    passwordConfirm: string;
}

export interface UpdatePasswordInput{
    passwordCurrent: string;
    password: string;
    passwordConfirm: string;
}
