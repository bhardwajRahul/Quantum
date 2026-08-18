#!/usr/bin/env node
'use strict';

const fs = require('fs');

const SRC = process.argv[2];
if(!SRC){ console.error('usage: strip-css-comments.js <file>'); process.exit(3); }

const text = fs.readFileSync(SRC, 'utf8');
let i = 0;
const N = text.length;
const out = [];

while(i < N){
    if(text[i] === '"' || text[i] === '\''){
        const quote = text[i];
        out.push(text[i]); i++;
        while(i < N && text[i] !== quote){
            if(text[i] === '\\' && i + 1 < N){ out.push(text[i], text[i + 1]); i += 2; continue; }
            out.push(text[i]); i++;
        }
        if(i < N){ out.push(text[i]); i++; }
        continue;
    }
    if(text[i] === '/' && text[i + 1] === '*'){
        const standalone = (() => {
            for(let j = out.length - 1; j >= 0; j--){
                const c = out[j];
                if(c === ' ' || c === '\t') continue;
                return c === '\n' || j < 0;
            }
            return true;
        })();
        i += 2;
        while(i < N && !(text[i] === '*' && text[i + 1] === '/')) i++;
        i += 2;
        if(standalone){
            while(out.length > 0){
                const last = out[out.length - 1];
                if(last === ' ' || last === '\t') out.pop();
                else break;
            }
        }else{
            out.push(' ');
        }
        continue;
    }
    out.push(text[i]); i++;
}

let result = out.join('')
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+/, '')
    .replace(/\s+$/, '\n');

if(result !== text){ fs.writeFileSync(SRC, result); process.exit(0); }
process.exit(1);
