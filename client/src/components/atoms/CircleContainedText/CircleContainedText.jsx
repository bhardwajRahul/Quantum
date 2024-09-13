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

import React from 'react';
import './CircleContainedText.css';

const CircleContainedText = ({ title, ...props }) => {
    return (
        <div className='Circle-Content-Container' {...props}>
            <h3 className='Circle-Content-Container-Title'>{title}</h3>
        </div>
    );
};

export default CircleContainedText;