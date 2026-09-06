export const shellSplit = (command: string): string[] => {
    const words: string[] = [];
    let current = '';
    let quote: '"' | "'" | null = null;
    let pending = false;

    for(let index = 0; index < command.length; index += 1){
        const char = command[index];

        if(quote === "'"){
            if(char === "'") quote = null;
            else current += char;
            continue;
        }

        if(quote === '"'){
            if(char === '"') quote = null;
            else if(char === '\\' && index + 1 < command.length) current += command[++index];
            else current += char;
            continue;
        }

        if(char === "'" || char === '"'){
            quote = char;
            pending = true;
        }else if(char === '\\' && index + 1 < command.length){
            current += command[++index];
            pending = true;
        }else if(/\s/.test(char)){
            if(pending || current !== '') words.push(current);
            current = '';
            pending = false;
        }else{
            current += char;
            pending = true;
        }
    }

    if(pending || current !== '') words.push(current);
    return words;
};
