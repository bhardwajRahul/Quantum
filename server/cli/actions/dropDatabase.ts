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

import prompts from 'prompts';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

const dropDatabase = async (): Promise<any> => {
    const { confirm } = await prompts({
        type: 'confirm', 
        name: 'confirm', 
        message: 'Are you sure you want to perform this action? You will not be able to redo',
        initial: true
    });
    if(!confirm){
        console.log('[Quantum Manager]: Perfect, no action will be executed.')
        return;
    }
    await mongoose.connection.dropDatabase();
    const quantumDir = path.join('/var/lib/quantum', process.env.NODE_ENV || 'development');
    console.log('[Quantum Manager]: The database has been deleted successfully.');
    console.log(`[Quantum Manager]: Tried to delete the "${quantumDir}" directory that contains .logs files and downloaded repositories...`);
    fs.rm(quantumDir, { recursive: true }, () => {
        console.log(`[Quantum Manager]: Directory "${quantumDir}" successfully deleted. The database has been cleaned and the debris within the file system as well. Your instance is clean.`)
    });
};

export default dropDatabase;