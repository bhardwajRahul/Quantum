export interface Preset {
    framework: string;
    runtime: 'node' | 'python' | 'go' | 'static';
    installCommand: string;
    buildCommand: string;
    startCommand: string;
    outputDirectory: string;
    port: number;
}

export const detectPreset = (files: string[], packageJson?: any): Preset => {
    const deps = { ...packageJson?.dependencies, ...packageJson?.devDependencies };

    if(deps.next)
        return { framework: 'Next.js', runtime: 'node', installCommand: 'npm install', buildCommand: 'npm run build', startCommand: 'npm run start', outputDirectory: '.next', port: 3000 };
    if(deps.nuxt)
        return { framework: 'Nuxt', runtime: 'node', installCommand: 'npm install', buildCommand: 'npm run build', startCommand: 'npm run start', outputDirectory: '.output', port: 3000 };
    if(deps['@remix-run/dev'])
        return { framework: 'Remix', runtime: 'node', installCommand: 'npm install', buildCommand: 'npm run build', startCommand: 'npm run start', outputDirectory: 'build', port: 3000 };
    if(deps.astro)
        return { framework: 'Astro', runtime: 'node', installCommand: 'npm install', buildCommand: 'npm run build', startCommand: 'npm run preview', outputDirectory: 'dist', port: 4321 };
    if(deps.vite)
        return { framework: 'Vite', runtime: 'node', installCommand: 'npm install', buildCommand: 'npm run build', startCommand: 'npm run preview', outputDirectory: 'dist', port: 4173 };
    if(deps['react-scripts'])
        return { framework: 'Create React App', runtime: 'node', installCommand: 'npm install', buildCommand: 'npm run build', startCommand: 'npx serve -s build', outputDirectory: 'build', port: 3000 };

    if(packageJson)
        return { framework: 'Node', runtime: 'node', installCommand: 'npm install', buildCommand: packageJson.scripts && packageJson.scripts.build ? 'npm run build' : '', startCommand: 'npm start', outputDirectory: '', port: 3000 };

    if(files.includes('requirements.txt') || files.includes('pyproject.toml'))
        return { framework: 'Python', runtime: 'python', installCommand: files.includes('requirements.txt') ? 'pip install -r requirements.txt' : 'pip install .', buildCommand: '', startCommand: files.includes('main.py') ? 'python main.py' : 'python app.py', outputDirectory: '', port: 8000 };

    if(files.includes('go.mod'))
        return { framework: 'Go', runtime: 'go', installCommand: 'go mod download', buildCommand: 'go build -o app', startCommand: './app', outputDirectory: '', port: 8080 };

    if(files.includes('index.html'))
        return { framework: 'Static', runtime: 'static', installCommand: '', buildCommand: '', startCommand: '', outputDirectory: '.', port: 80 };

    return { framework: 'Node', runtime: 'node', installCommand: 'npm install', buildCommand: '', startCommand: 'npm start', outputDirectory: '', port: 3000 };
};
