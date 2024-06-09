const fs = require('fs');
const readline = require('readline');
const util = require('util');
const { exec } = require('child_process');
const execAsync = util.promisify(exec);

// Is this correct?
const NGINX_FILE = '/etc/nginx/sites-enabled/default';

/**
 * Reads the current contents of the Nginx configuration file.
 * @returns {string} The Nginx configuration content.
*/
const getCurrentConfig = () => {
    return fs.readFileSync(NGINX_FILE, 'utf-8');
};

/**
 * Checks if a specific domain's configuration block exists in the Nginx file.
 * @param {string} domain The domain name to check for.
 * @returns {boolean} True if the domain block exists, false otherwise.
 */
 exports.domainExists = (domain) => {
    const currentConfig = getCurrentConfig();
    const startPattern = `# Start-Quantum-Block-${domain}\n`;
    const endPattern = `# End-Quantum-Block-${domain}\n`;
    return currentConfig.includes(startPattern) && currentConfig.includes(endPattern);
};

/**
 * Removes a list of domains from the Nginx configuration.
 * 
 * @param {string[]} domains An array of domain names to remove.
 * @returns {Promise<void>} Resolves when all domains have been processed.
*/
exports.removeDomainList = async (domains) => {
    await Promise.all(domains.map(async (domain) => {
        try{
            await exports.removeDomain(domain);
        }catch(error){
            console.error(`[Quantum Cloud]: Error removing domain '${domain}':`, error);
        }
    }));
};

/**
 * Removes all Quantum Blocks from the Nginx configuration file.
*/
exports.removeDomains = () => {
    const rl = readline.createInterface({ input: fs.createReadStream(NGINX_FILE) });
    let newConfig = '';
    let inQuantumBlock = false;
    rl.on('line', (line) => {
        if(line.startsWith('# Start-Quantum-Block-')){
            inQuantumBlock = true;
        }else if(line.startsWith('# End-Quantum-Block-')){
            inQuantumBlock = false;
        }else if(!inQuantumBlock){
            newConfig += line + '\n';
        }
    });
    rl.on('close', async () => {
        fs.writeFileSync(NGINX_FILE, newConfig);
        // Reload NGINX for changes to take effect
        await reloadNginx();
    });
};

/**
 * Removes a specific domain's configuration block from the Nginx file.
 * @param {string} domain The domain name to remove.
*/
exports.removeDomain = async (domain) => {
    if(!this.domainExists(domain)) return;
    const currentConfig = getCurrentConfig();
    const startPattern = `# Start-Quantum-Block-${domain}\n`;
    const endPattern = `# End-Quantum-Block-${domain}\n`;
    const startIndex = currentConfig.indexOf(startPattern);
    const endIndex = currentConfig.indexOf(endPattern, startIndex) + endPattern.length;
    if(startIndex === -1 || endIndex === -1){
        console.error(`[Quantum Cloud]: Domain '${domain}' not found in NGINX configuration.`);
        return;
    }
    const updatedConfig = currentConfig.substring(endIndex) + currentConfig.substring(0, startIndex);
    fs.writeFileSync(NGINX_FILE, updatedConfig);
    await reloadNginx();
};

/**
 * Updates a domain's configuration in the Nginx file (removes old, adds new).
 * @param {Object} domainConfig An object containing domain configuration properties:
 *   - domain: The domain name.
 *   - ipv4: The IPv4 address.
 *   - port: The port number.
*/
exports.updateDomain = async (domainConfig) => {
    await this.removeDomain(domainConfig.domain);
    await this.addDomain(domainConfig);
};

exports.addDomain = async (domainConfig) => {
    const { domain, ipv4, port, useSSL = false } = domainConfig;
    if(this.domainExists(domain)) return;
    // Input validation
    if(!domain || !ipv4 || !port){
        throw new Error('NGINXHandler::Invalid::Params');
    }
    // SSL Configuration (if enabled)
    let sslTemplate = '';
    if(useSSL){
        sslTemplate = `
server {
    listen 443 ssl;
    server_name ${domain};

    ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;

    location / {
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_pass http://${ipv4}:${port};
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# Redirect HTTP to HTTPS (if SSL is enabled)
server {
    if ($host = ${domain}) {
        return 301 https://$host$request_uri;
    } 
    listen 80;
    server_name ${domain};
    return 404; 
}
        `;
    }
    // Main Configuration Template
    const template = `
# Start-Quantum-Block-${domain}
server {
    listen 80; 
    server_name ${domain};

    location / {
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_pass http://${ipv4}:${port};
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

${sslTemplate}
# End-Quantum-Block-${domain}
    `;
    // File Modification
    try{
        const currentConfig = getCurrentConfig();
        fs.writeFileSync(NGINX_FILE, currentConfig + template);
        await reloadNginx();
    }catch(error){
        console.error('[Quantum Cloud]: Error adding domain configuration ->', error);
        throw error;
    }
};

/**
 * Reloads the Nginx configuration.
*/
const reloadNginx = async () => {
    await execAsync('nginx -s reload');
};

exports.generateSSLCert = async (domain, email) => {
    const certPath = `/etc/letsencrypt/live/${domain}/fullchain.pem`;
    // Check if SSL certificate already exists
    if(fs.existsSync(certPath)){
        console.log(`[Quantum Cloud]: SSL Certificate already exists for ${domain}.`);
        return;
    }
    const command = `certbot certonly --webroot -w ${__dirname}/../public -d ${domain} --agree-tos --email ${email} --non-interactive`;
    try{
        await execAsync(command);
        console.log(`[Quantum Cloud]: SSL certificate generated successfully for ${domain}`);
    }catch(error){
        console.error(`[Quantum Cloud]: Error generating SSL certificate: ${error}`);
        // Re-throw to propagate the error
        throw error;
    }
};

module.exports = exports;