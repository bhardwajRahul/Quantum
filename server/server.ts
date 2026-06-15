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

import { httpServer, io } from '@config/express';
import { cleanHostEnvironment } from '@utilities/helpers';
import logger from '@utilities/logger';
import sendMail from '@services/sendEmail';
import mongoConnector from '@utilities/mongoConnector';
import * as bootstrap from '@utilities/bootstrap';
import { startOrchestrator } from '@services/orchestrator';
import { runTenancyBackfill } from '@services/tenancy/provisioning';
import wsController from '@controllers/wsController';

wsController(io);

// Server configuration
const SERVER_PORT: number = Number(process.env.SERVER_PORT) || 8000;
const SERVER_HOST: string = process.env.SERVER_HOSTNAME || '0.0.0.0';

/**
 * Handles uncaught exceptions, cleans the environment, and restarts the server. 
 * @param {Error} err - The uncaught exception.
*/
process.on('uncaughtException', async (error:Error) => {
    logger.error('@server.ts: Uncaught Exception: ' + error);
    await cleanHostEnvironment();
    if(process.env.NODE_ENV !== 'production') return;
    logger.info('@server.ts: Restarting server...');
    await sendMail({
        subject: 'Critical runtime error, restarting server...',
        html: `A critical error has been registered in the execution of the platform server. This error cannot be ignored and continue executing instructions, so the server will be forcefully restarted to maintain the integrity of the platform and its hosted services. Keep in mind that the latter can get into a loop. We will leave you error information:\n${error}`
    });
});

/**
 * Handles unhandledRejection and print in console.
 * @param {String} reason - The unhandled rejection.
*/
process.on('unhandledRejection', (reason:any) => {
    logger.error('@server.ts: Unhandled Promise Rejection, reason: ' + reason);
});

/**
 * Handles SIGINT (Ctrl-C) for graceful shutdown.
*/
process.on('SIGINT', async () => {
    logger.info('@server.ts: SIGINT signal received, shutting down...');
    await cleanHostEnvironment();
    await sendMail({
        subject: 'Quantum and hosted services have stopped successfully.',
        html: 'The server has safely completed execution. A certain signal has been received and all services hosted on the platform have been terminated. After sending this email, the server will be closed. See you later!'
    });
    process.exit(0);
});

// Starts the HTTP Server
httpServer.listen(SERVER_PORT, SERVER_HOST, async () => {
    try{
        // Ensures necessary environment variables exists
        bootstrap.validateEnvironmentVariables();
        // Establishes a connection to the MongoDB database
        await mongoConnector();
        // Backfill tenancy (default org/project/environment + owner membership for
        // every pre-existing user/repository). Idempotent; must run before serving
        // requests so the central tenant scoping has context to resolve against.
        await runTenancyBackfill();
        logger.info('@server.ts: Starting the deploy orchestrator. Containers will be reconciled (recreated/started) and user applications brought up as needed...');
        // Start the orchestrator: worker pool + boot reconciliation (desired-vs-actual
        // self-heal) + periodic reconcile. This replaces the old blanket
        // bootstrap.deployContainers() Promise.all that force-started every container.
        await startOrchestrator();
        // Email to WEBMASTER_MAIL to notify about the correct opening of the server.
        await sendMail({
            subject: 'The Quantum API is now accessible!',
            html: 'Your instance has been successfully deployed within your server.'
        });
        logger.info(`@server.ts: Running at http://${SERVER_HOST}:${SERVER_PORT}/.`);
    }catch(error){
        logger.error('@server.ts: Error during server initialization: ' + error);
        process.exit(1);
    }
});