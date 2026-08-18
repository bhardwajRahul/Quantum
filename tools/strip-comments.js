#!/usr/bin/env node

'use strict';

const fs = require('fs');

const SRC = process.argv[2];
if(!SRC){
    console.error('usage: strip-comments.js <file>');
    process.exit(3);
}

const text = fs.readFileSync(SRC, 'utf8');

let i = 0;
const N = text.length;
const out = [];

let regexAllowed = true;

let jsxDepth = 0;

const peek = (off = 0) => text[i + off];
const startsWith = (s) => text.startsWith(s, i);

const lastNonWS = () => {
    for(let j = out.length - 1; j >= 0; j--){
        const c = out[j];
        if(c === ' ' || c === '\t' || c === '\n' || c === '\r') continue;
        return c;
    }
    return '';
};

const emit = (c) => {
    out.push(c);
    if(c === ' ' || c === '\t' || c === '\n' || c === '\r') return;

    if(/[=(,;:!&|?{}[\n+\-*%~^<>]/.test(c)){
        regexAllowed = true;
    }else{
        regexAllowed = false;
    }
};

const consumeString = (quote) => {
    out.push(text[i]);
    i++;
    while(i < N){
        const c = text[i];
        if(c === '\\' && i + 1 < N){
            out.push(c, text[i + 1]);
            i += 2;
            continue;
        }
        if(c === quote){
            out.push(c);
            i++;
            regexAllowed = false;
            return;
        }
        out.push(c);
        i++;
    }
};

const consumeTemplate = () => {
    out.push('`');
    i++;
    while(i < N){
        const c = text[i];
        if(c === '\\' && i + 1 < N){
            out.push(c, text[i + 1]);
            i += 2;
            continue;
        }
        if(c === '`'){
            out.push(c);
            i++;
            regexAllowed = false;
            return;
        }
        if(c === '$' && text[i + 1] === '{'){

            out.push('$', '{');
            i += 2;
            let depth = 1;
            while(i < N && depth > 0){
                const k = text[i];
                if(k === '"' || k === '\''){ consumeString(k); continue; }
                if(k === '`'){ consumeTemplate(); continue; }
                if(k === '/' && text[i + 1] === '/'){ skipLineComment(); continue; }
                if(k === '/' && text[i + 1] === '*'){ skipBlockComment(); continue; }
                if(k === '{') depth++;
                if(k === '}') depth--;
                if(depth === 0){ out.push(k); i++; break; }
                out.push(k);
                i++;
            }
            continue;
        }
        out.push(c);
        i++;
    }
};

const consumeRegex = () => {
    out.push('/');
    i++;
    let inClass = false;
    while(i < N){
        const c = text[i];
        if(c === '\\' && i + 1 < N){
            out.push(c, text[i + 1]);
            i += 2;
            continue;
        }
        if(c === '[' && !inClass){ inClass = true; out.push(c); i++; continue; }
        if(c === ']' && inClass){ inClass = false; out.push(c); i++; continue; }
        if(c === '/' && !inClass){
            out.push(c);
            i++;

            while(i < N && /[gimsuyd]/.test(text[i])){ out.push(text[i]); i++; }
            regexAllowed = false;
            return;
        }
        if(c === '\n'){

            return;
        }
        out.push(c);
        i++;
    }
};

const skipLineComment = () => {

    while(i < N && text[i] !== '\n') i++;

    while(out.length > 0){
        const last = out[out.length - 1];
        if(last === ' ' || last === '\t') out.pop();
        else break;
    }
};

const skipBlockComment = () => {

    const startedOnNewlineBoundary = (() => {

        for(let j = out.length - 1; j >= 0; j--){
            const c = out[j];
            if(c === ' ' || c === '\t') continue;
            return c === '\n' || j < 0;
        }
        return true;
    })();
    let hadNewline = false;
    i += 2;
    while(i < N){
        if(text[i] === '*' && text[i + 1] === '/'){
            i += 2;
            break;
        }
        if(text[i] === '\n') hadNewline = true;
        i++;
    }
    if(startedOnNewlineBoundary){

        while(out.length > 0){
            const last = out[out.length - 1];
            if(last === ' ' || last === '\t') out.pop();
            else break;
        }
        if(!hadNewline){

        }
    }else{

        emit(' ');
    }
};

while(i < N){
    const c = text[i];
    const next = text[i + 1];

    if(c === '"' || c === '\''){ consumeString(c); continue; }
    if(c === '`'){ consumeTemplate(); continue; }

    if(c === '/' && next === '/'){ skipLineComment(); continue; }
    if(c === '/' && next === '*'){ skipBlockComment(); continue; }

    if(c === '/' && regexAllowed){ consumeRegex(); continue; }

    if(c === ':' && next === '/' && text[i + 2] === '/'){

        out.push(':', '/', '/');
        i += 3;
        regexAllowed = false;
        continue;
    }

    emit(c);
    i++;
}

let result = out.join('');

result = result
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')

    .replace(/^([ \t]*)\{[ \t]*\}[ \t]*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')

    .replace(/^\s+/, '')

    .replace(/\s+$/, '\n');

if(result !== text){
    fs.writeFileSync(SRC, result);
    process.exit(0);
}else{
    process.exit(1);
}
