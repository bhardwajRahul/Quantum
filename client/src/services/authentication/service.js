import APIRequestBuilder from '@utilities/api/apiRequestBuilder';

export const AuthenticationAPI = new APIRequestBuilder('/auth');

export const signUp = AuthenticationAPI.register({
    path: '/sign-up/',
    method: 'POST'
});

export const myProfile = AuthenticationAPI.register({
    path: '/me/',
    method: 'GET'
});

export const updateMyPassword = AuthenticationAPI.register({
    path: '/me/update/password/',
    method: 'PATCH'
});

export const updateMyProfile = AuthenticationAPI.register({
    path: '/me/',
    method: 'PATCH'
});

export const deleteMyProfile = AuthenticationAPI.register({
    path: '/me/',
    method: 'DELETE'
});

export const signIn = AuthenticationAPI.register({
    path: '/sign-in/',
    method: 'POST'
});

export const logout = AuthenticationAPI.register({
    path: '/me/logout/',
    method: 'GET'
});