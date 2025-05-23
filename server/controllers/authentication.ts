/***
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 * Licensed under the MIT license. See LICENSE file in the project root
 * for full license information.
 *
 * =+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
 *
 * For related information - https://github.com/rodyherrera/Quantum/
 *
 * All your applications, just in one place. 
 *
 * =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
****/

import jwt from 'jsonwebtoken';
import User from '@models/user';
import HandlerFactory from '@controllers/common/handlerFactory';
import { catchAsync, deleteJWTCookie, filterObject } from '@utilities/helpers';
import { IUser } from '@typings/models/user';
import sendEmail from '@services/sendEmail';
import RuntimeError from '@utilities/runtimeError';

const UserFactory = new HandlerFactory({
    model: User,
    fields: [
        'username',
        'fullname',
        'github',
        'email',
        'password',
        'passwordConfirm'
    ]
});

/**
 * Generates a JSON Web Token (JWT) for authentication.
 *
 * @param {string} identifier - The user's unique identifier (typically their database ID).
 * @returns {string} - The signed JWT.
 */
const signToken = (identifier: string): string => {
    const expiresIn = `${process.env.JWT_EXPIRATION_DAYS}d`;
    return jwt.sign({ id: identifier }, process.env.SECRET_KEY!, {
        expiresIn
    });
};

/**
 * Creates a new JWT and sends it in the response along with user data.
 * 
 * @param {Object} res - The Express response object.
 * @param {number} statusCode - HTTP status code to send in the response.
 * @param {Object} user - The user object to include in the response.
 */
const createAndSendToken = (res: any, statusCode: number, user: any): void => {
    const token = signToken(user._id);
    user.password = undefined;
    user.__v = undefined;

    deleteJWTCookie(res);
    res.cookie('jwt', token, {
        expires: new Date(Date.now() + Number(process.env.JWT_EXPIRATION_DAYS) * 24 * 60 * 60 * 1000),
        httpOnly: true
    });

    res.status(statusCode).json({
        status: 'success',
        data: { user }
    });
};

/**
 * Handles user sign-in requests. Authenticates the user based on email and password. 
 * If successful, generates and sends a JWT.
 *
 * @returns {Promise<void>}
 */
export const signIn = catchAsync(async (req: any, res: any, next: any): Promise<void> => {
    const { email, password } = req.body;
    if(!email || !password){
        return next(new RuntimeError('Authentication::EmailOrPasswordRequired', 400));
    }
    const requestedUser = await User.findOne({ email }).select('+password').populate('github');
    if(!requestedUser || !(await requestedUser.isCorrectPassword(password, requestedUser.password))){
        return next(new RuntimeError('Authentication::EmailOrPasswordIncorrect', 400));
    }
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    sendEmail({
        to: email,
        subject: `Someone is logged into your account.`,
        html: `The client's IP address is "${clientIp}", is that you? Remember to set a strong password to protect your data and services.`
    });
    createAndSendToken(res, 200, requestedUser);
});

/**
 * Handles user sign-up requests. Creates a new user in the database and sends a JWT in the response.
 * 
 * @returns {Promise<void>}
 */
export const signUp = catchAsync(async (req: any, res: any, next: any): Promise<void> => {
    const { username, fullname, email, password, passwordConfirm } = req.body;
    if(process.env.REGISTRATION_DISABLED === 'true'){
        return next(new RuntimeError('Authentication::Disabled', 200));
    }
    const newUser = await User.create({ username, fullname, email, password, passwordConfirm });
    sendEmail({
        to: email,
        subject: `Hello @${username}!`,
        html: `Your account has been created successfully.`
    });
    createAndSendToken(res, 201, newUser);
});

/**
 * Updates the authenticated user's password. Verifies the current password and ensures the new password is different. 
 * Updates the user record and sends a JWT with the updated user data.
 *
 * @returns {Promise<void>}
*/
export const updateMyPassword = catchAsync(async (req: any, res: any, next: any): Promise<void> => {
    const requestedUser = await User.findById(req.user.id).select('+password').populate('github') as IUser;
    if(!(await requestedUser.isCorrectPassword(req.body.passwordCurrent, requestedUser.password))){
        return next(new RuntimeError('Authentication::Update::PasswordCurrentIncorrect', 400));
    }
    if(await requestedUser.isCorrectPassword(req.body.passwordConfirm, requestedUser.password)){
        return next(new RuntimeError('Authentication::Update::PasswordsAreSame', 400));
    }
    requestedUser.password = req.body.password;
    requestedUser.passwordConfirm = req.body.passwordConfirm;
    await requestedUser.save();
    sendEmail({
        to: requestedUser.email,
        subject: 'Password updated successfully.',
        html: `Hello @rodyherrera, you have changed your password correctly. You may need to log in again on devices where you had your session active.`
    });
    createAndSendToken(res, 200, requestedUser);
});

/**
 * Deletes the authenticated user's account.
 *
 * @returns {Promise<void>}
*/
export const deleteMyAccount = catchAsync(async (req: any, res: any, next: any): Promise<void> => {
    const requestedUser = await User.findByIdAndDelete(req.user.id);
    if(!requestedUser){
        return next(new RuntimeError('Authentication::Delete::UserNotFound', 404));
    }
    sendEmail({
        to: requestedUser.email,
        subject: 'You have deleted your account.',
        html: `All your data on the platform has been deleted. This action is irreversible.`
    }); 
    res.status(204).json({
        status: 'success',
        data: requestedUser
    });
});

/**
 * Retrieves the authenticated user's profile. 
 *
 * @returns {Promise<void>}
 */
export const getMyAccount = catchAsync(async (req: any, res: any, next: any): Promise<void> => {
    const requestedUser = await User.findById(req.user.id).populate('github');
    if(!requestedUser){
        return next(new RuntimeError('Authentication::Get::UserNotFound', 404));
    }
    res.status(200).json({
        status: 'success',
        data: requestedUser
    });
});

/**
 * Updates the authenticated user's profile. Allows updates to username, fullname, and email. 
 * 
 * @returns {Promise<void>}
 */
export const updateMyAccount = catchAsync(async (req: any, res: any, next: any): Promise<void> => {
    const filteredBody = filterObject(req.body, 'username', 'fullname', 'email');
    const requestedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
        new: true,
        runValidators: true
    }).populate('github');
    if(!requestedUser){
        return next(new RuntimeError('Authentication::Update::UserNotFound', 404));
    }
    res.status(200).json({
        status: 'success',
        data: requestedUser
    });
});

export const logout = catchAsync(async (req: any, res: any, next: any): Promise<void> => {
    deleteJWTCookie(res);
    res.status(200).json({ status: 'success' });
});

export const deleteUser = UserFactory.deleteOne();
export const getUser = UserFactory.getOne();
export const getAllUsers = UserFactory.getAll();
export const updateUser = UserFactory.updateOne();
export const createUser = UserFactory.createOne();