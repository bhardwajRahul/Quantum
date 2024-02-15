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

exports.filterObject = (object, ...fields) => {
    const filteredObject = {};
    Object.keys(object).forEach((key) =>
        (fields.includes(key)) && (filteredObject[key] = object[key]));
    return filteredObject;
};

exports.checkIfSlugOrId = (id) => {
    if(id.length === 24)
        return { _id: id };
    return { slug: id };
};

exports.catchAsync = (asyncFunction, finalFunction = undefined) => (req, res, next) => {
    let executeFinally = true;
    return asyncFunction(req, res, next)
        .catch(next)
        .catch(() => (executeFinally = false))
        .finally(() => setTimeout(() => 
            (executeFinally && typeof finalFunction === 'function') && (finalFunction(req)), 100));
};

module.exports = exports;