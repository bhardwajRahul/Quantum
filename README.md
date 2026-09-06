# The Open-Source and Self-Hosted Alternative to Heroku, Netlify, and Vercel 🚀
![Quantum Home Page](/screenshots/Quantum-Cloud-Platform.png)
<div>
<a href="https://ko-fi.com/codewithrodi"> <img align="left" src="https://cdn.ko-fi.com/cdn/kofi3.png?v=3" height="50"   width="180" alt="Support Quantum!" /></a>
</div>
<br /> <br />

## Table of Contents
- [Quick Start](#quick-start)
- [Configuration Reference](#configuration-reference)
- [HTTPS for the Dashboard](#https-for-the-dashboard)
- [Docker Compose Stacks and Internal Addresses](#docker-compose-stacks-and-internal-addresses)
- [Day-to-Day Operations](#day-to-day-operations)
- [Deploying Without Docker](#deploying-without-docker)
- [Obtaining GitHub Client Secret and Client ID](#obtaining-github-client-secret-and-client-id)
- [Using NGINX as a Reverse Proxy](#using-nginx-as-a-reverse-proxy)
- [Creating Your Admin Account](#creating-your-admin-account)
- [Where Are Repositories and Logs Stored?](#where-are-repositories-and-logs-stored)
- [What Happens When the Server Is Closed?](#what-happens-when-the-server-is-closed)
- [Custom Domains for Your Deployments](#custom-domains-for-your-deployments)
- [We'd Love Your Feedback and Support!](#wed-love-your-feedback-and-support)

Quantum allows you to effortlessly deploy your GitHub repositories, integrating real-time continuous deployment seamlessly. Additionally, you can easily deploy and manage Docker containers. With "One Click Services," you have access to over 20 applications that you can deploy to your Quantum account with just a single click. Among these applications are Uptime Kuma, Code Server, Ollama, various Databases, and many more.

With Quantum, you have full access to the file systems of all your Docker containers and your deployed GitHub repositories. This enables you to make adjustments directly without the need to perform an immediate commit. You can configure environment variables, access the terminal, restart or shut down containers, and utilize many other functionalities.

To deploy the application you only need Docker — see [Quick Start](#quick-start) below. One command clones, configures, generates secrets and brings the whole stack up.

![Quantum Cloud Dashboard](/screenshots/Dashboard.png)
![Quantum Cloud Console](/screenshots/Cloud-Console.png)
![Repository CLI](/screenshots/RepositoryCLI.png)
![Repository File Explorer](/screenshots/File-Explorer.png)

While Quantum offers a panel for configuring commands such as installing dependencies (e.g., "npm install"), building source code (e.g., "npm run build"), or starting your software (e.g., "npm run start"), it also provides a separate panel specifically for managing environment variables. It's worth noting that this isn't a manual process where you input variables and their values one by one. When the repository is cloned, Quantum automatically maps the environment variables, allowing you to assign their respective values later on. You have the flexibility to create, delete, and modify environment variables associated with the deployment of your repository as needed.

![Repository Environment Variables](/screenshots/RepositoryEnvironVariables.png)
![User Profile](/screenshots/User-Profile.png)
I've successfully **migrated all my frontend applications from Vercel and my various VPS services to Quantum**. The platform's ease of use and efficiency are evident in the 15 repositories I currently have deployed – a testament to my confidence in Quantum.

## Quick Start

You need a Linux host with Docker and the Compose plugin. If you don't have Docker yet, `bash scripts/install_docker.sh` installs it.

```bash
git clone https://github.com/rodyherrera/Quantum
cd Quantum
bash scripts/deploy.sh
```

That's it. The script creates `.env` from `.env.example`, generates every secret with `openssl rand`, builds the images, starts the stack and waits until the API answers. When it finishes it prints your URLs.

By default the web app is served on port **5050** and the API on **7080**.

Then create your first account by signing up through the web app — self-signup
is open by default. Lock it back down once you have an account by setting
`REGISTRATION_DISABLED=true` in `.env` and running
`docker compose up -d --build api`.

### Deploying on a public server

```bash
bash scripts/deploy.sh --public                      # autodetect the public IP
bash scripts/deploy.sh --host quantum.example.com    # or use a domain
```

Make sure ports `5050`, `7080`, `80` and `443` are open in your firewall.

### Re-running and updating

`scripts/deploy.sh` is idempotent — it never overwrites a value you already set in `.env`. To pull an update:

```bash
git pull && bash scripts/deploy.sh
```

### If you prefer plain Compose

The script is only a convenience wrapper. This works too, as long as `.env` has the two secrets and a Postgres password filled in:

```bash
cp .env.example .env
# fill SECRET_KEY, ENCRYPTION_KEY, POSTGRES_PASSWORD
docker compose up -d --build
```

Every other variable has a working default, and Compose fails with an explicit message naming the variable if a required secret is missing.

## Configuration Reference

Everything lives in a single `.env` at the repository root; [`.env.example`](.env.example) documents each variable. Only these need your attention:

| Variable | Required | Notes |
|---|---|---|
| `SECRET_KEY` | yes | Any long random string. Generated for you. Signs JWTs. |
| `ENCRYPTION_KEY` | yes | **64 hex chars**, or base64 for exactly 32 bytes — encrypts stored GitHub tokens. |
| `POSTGRES_PASSWORD` | yes | Generated for you. |
| `DOMAIN`, `CLIENT_HOST` | yes | Full URLs *with* scheme and port, as the **browser** sees them. Never `0.0.0.0` here — the API allows CORS only from exactly `CLIENT_HOST`, so it must match the hostname in your address bar (`localhost` locally, or `127.0.0.1` if that's what you type). |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | for repo deploys | See [GitHub OAuth](#obtaining-github-client-secret-and-client-id). |
| `PANEL_HOST`, `ACME_EMAIL` | optional | Serves the dashboard over HTTPS on a hostname of yours. |
| `SMTP_*`, `WEBMASTER_MAIL` | optional | Password resets and alert emails. |

`DOMAIN` is compiled into the frontend bundle at image build time, so rebuild the web app after changing it: `docker compose up -d --build web`.

## HTTPS for the Dashboard

The stack ships with [Traefik](https://traefik.io/), so the dashboard can be served over HTTPS on a hostname of yours without configuring a reverse proxy by hand. Point an A record at the server:

```
panel.example.com    A    <your server IP>
```

then set in `.env`:

```bash
PANEL_HOST=panel.example.com
ACME_EMAIL=you@example.com
# once staging certificates work, switch to the rate-limited production CA:
ACME_CA_SERVER=https://acme-v02.api.letsencrypt.org/directory
```

Traefik then issues and renews a Let's Encrypt certificate for that hostname and routes both the web app and the API behind it. Leave `PANEL_HOST` empty to skip this entirely — the dashboard stays reachable on its published ports.

Your deployments are reachable through their published ports; see [Custom domains for your deployments](#custom-domains-for-your-deployments) to put a hostname in front of one.

Traefik needs ports **80** and **443**. If they're already taken on the host, set `TRAEFIK_HTTP_PORT` / `TRAEFIK_HTTPS_PORT`, but note that Let's Encrypt's HTTP challenge only works on the standard ports.

## Docker Compose Stacks and Internal Addresses

Besides GitHub repositories and one-click templates, an application can be a Docker Compose file. **Applications → Deploy compose** opens an editor: paste the file, pick a project and deploy. Every service becomes its own container on a private network for the stack, so services reach each other by name (`http://api:9000`) exactly as they would with `docker compose up`. The file stays editable afterwards in the stack's **Compose** tab, and each service's variables in its **Environment** tab; both save automatically and apply on **Redeploy**.

Supported per service: `image`, `command`, `environment`, `ports`, `volumes` (named volumes only), `depends_on`. Published host ports are assigned by Quantum, as for every other application. `build:` contexts and host bind mounts are rejected with a message naming the service.

Private images work once the organization has credentials for their registry: **Settings → Organization → Container registries** takes the registry host, a username and a token, and every pull of an image from that host uses them. For GitHub Container Registry create a classic personal access token with the `read:packages` scope; without an explicit entry for `ghcr.io`, Quantum falls back to the connected GitHub account of the application's owner.

Every application can be opened in VS Code from its page: **Open in VS Code** starts a [code-server](https://github.com/coder/code-server) container next to the app that mounts the same files the app sees (the repository checkout, or every named volume of a compose stack under its service name), joins its network, and hands you a URL plus a generated password. Edits to a repository land in `/app` immediately; exec apps pick them up on Restart, Dockerfile and prebuilt-image apps on the next deploy, and the next push from GitHub replaces tracked files, so commit from VS Code what you want to keep. Stop the workspace from the same dialog to free its memory.

Every container Quantum runs, whatever its kind, also joins a network shared by the whole organization. The **Address** column in Applications shows the container's IP on that network and a stable hostname (the application's alias), so an app deployed from GitHub can reach a compose service or a managed database at `http://<hostname>:<port>` without publishing anything to the host. IPs can change when a container is recreated; prefer the hostname in configuration.

## Day-to-Day Operations

```bash
docker compose ps                      # what's running
docker compose logs -f api             # follow API logs
docker compose restart api             # restart just the API
docker compose down                    # stop everything, data preserved
docker compose down -v                 # stop and DELETE all data
```

The stack is four containers: `quantum-api` (API), `quantum-web` (web app), `quantum-postgres` (database) and `quantum-traefik` (ingress/TLS).

Postgres is bound to `127.0.0.1` only, so it is reachable for backups from the host but never from the internet:

```bash
docker compose exec postgres pg_dump --username "$POSTGRES_USER" "$POSTGRES_DB" > backup.sql
```

## Deploying Without Docker

Not recommended — Quantum drives the Docker daemon to run your deployments, so Docker has to be present anyway. If you still want the services on the host, run everything from the repo root (it's a pnpm workspace) and supply your own Postgres:

**API**

```bash
pnpm install
DOMAIN=http://localhost:7080 \
CLIENT_HOST=http://localhost:5050 \
SECRET_KEY=... \
ENCRYPTION_KEY=... \
DATABASE_URL=postgresql://quantum:password@localhost:5432/quantum \
pnpm --filter @quantum/api start
```

See [Configuration Reference](#configuration-reference) and `packages/api/src/shared/config.ts` for the full list of variables the API reads.

**Web**

```bash
pnpm install
VITE_SERVER=http://localhost:7080 pnpm --filter @quantum/web build
npx serve -s packages/web/dist
```

## Obtaining GitHub Client Secret and Client ID
To integrate your application with GitHub's API, you'll need to obtain a Client Secret and Client ID. Follow these detailed steps to acquire them:

1. **Sign in to your GitHub account:** Go to [GitHub](https://github.com/) and sign in with your user credentials.
2. **Access your account settings:** Click on your profile avatar in the top right corner and select "Settings" from the dropdown menu.
3. **Navigate to the "Developer settings" section:** In the left sidebar, click on "Developer settings."
4. **Create a new OAuth application:** Select "OAuth Apps" and click on the "New OAuth App" button.
5. **Provide application information:** Please enter your app name, your home page URL, and return authorization URL. Please note that the "Home Page URL" must be the address where the server is hosted and cannot be local, that is, it must be accessible to third parties, for example: "http://82.208.22.71:5001 " or "quantum-server.mydomain.com". Likewise, the "Return Authorization URL" must contain the address where the server is hosted followed by the path of the API responsible for returning authorization from Github, for example: "http://82.208.22.71:5002/github/oauth/callback" or "https://quantum-server.mydomain.com/github/oauth/callback".
6. **Register the application:** Click on the "Register application" button.
7. **Copy the application credentials:** Once registered, GitHub will generate a Client ID and Client Secret. Copy these values and securely store them.
8. **Utilize the credentials in your application:** Use the Client ID and Client Secret in your application's configuration to authenticate requests to GitHub's API.

It is important that you do this step, otherwise NO ONE will simply be able to use your application, including you.

![Github OAuth Apps](/screenshots/Github-OAuth-Apps.png)
![Github OAuth App Config](/screenshots/Github-OAuth-App-Config.png)

## Using NGINX as a reverse proxy

> If all you want is HTTPS on **Quantum's own dashboard**, the bundled Traefik already does it — see [HTTPS for the Dashboard](#https-for-the-dashboard).
>
> This section is for putting a custom domain in front of the dashboard with your own NGINX, if you'd rather not expose ports 5050/7080 directly.

Personally, I recommend you use [NGINX Proxy Manager](https://nginxproxymanager.com/).
![NGINX Proxy Manager](/screenshots/NGINX-Proxy-Manager.png)

Otherwise, follow these instructions. (as you would with any other app):

### 1. Create Your DNS Records
First, you need to create A records in your DNS provider (e.g., Namecheap, GoDaddy, Cloudflare) that point your chosen domain (e.g., `quantum.yourdomain.com`) to the public IP address of the server hosting Quantum.

For example, in Namecheap, you’d add an A record like:
```vbnet
Host:    @
Value:   123.456.78.90  (Your server’s public IP)
TTL:     Automatic
```
*(You can also create subdomain records like `app.yourdomain.com` if preferred.)*

### 2. Install and Configure NGINX
On the server hosting Quantum, install NGINX (if you haven’t already). For most Linux distributions, the command is typically:

```bash
sudo apt-get update
sudo apt-get install nginx
```
Once installed, you can modify the default NGINX configuration or create a new one specific to your domain. For instance, in `/etc/nginx/sites-available/default`:

```nginx
server {
    listen 80;
    server_name quantum.yourdomain.com;

    location / {
        # Option 1: If you want to point directly to the Quantum server’s public IP and port
        # proxy_pass http://123.456.78.90:7080/;

        # Option 2: If you're hosting the Quantum back-end in Docker on the same machine,
        # you can use the Docker container’s internal IP (e.g., 172.17.0.2)
        # or `localhost` along with the mapped port.
        proxy_pass http://localhost:7080/;

        # Pass additional headers if necessary
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```
Replace `quantum.yourdomain.com` with your actual domain or subdomain, and adjust the IP/port according to your Quantum server configuration.

### 3. Enable the New Configuration
Next, test your NGINX configuration and reload if there are no errors:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 4. (Optional) Add HTTPS/SSL
To secure your domain with HTTPS, you can use Certbot or another SSL certificate provider:

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d quantum.yourdomain.com
```
Follow the prompts to complete the SSL setup.

### 5. Verify Your Setup
In a browser, navigate to `http://quantum.yourdomain.com` (or `https://...` if using SSL).
You should see your Quantum application served via NGINX at your custom domain.

**That’s it!** You have successfully set up NGINX as a reverse proxy for your Quantum deployment. From now on, you can access your Quantum server (and any associated front-end or back-end services) via the domain name(s) you configured, without needing to remember the internal ports or IP addresses.

## Creating Your Admin Account
Self-signup is open by default, so create your first account the normal way: open the web app and sign up.

Once you have an account, lock further signups by setting `REGISTRATION_DISABLED=true` in `.env` and rebuilding the API:

```bash
docker compose up -d --build api
```

## Custom domains for your deployments
To map your own domain to a service, expose its port and point a reverse proxy at it:

1. Use the public IP of the server where Quantum is hosted along with the exposed port of your service to set up the reverse proxy.

2. Alternatively, use the internal IP of the Docker container along with the internal port of your service.

Either way you'll need A records pointing to the IP address of the server where Quantum is hosted (as shown in the attached Namecheap screenshot).

![NameCheap A Record](/screenshots/NameCheapARecord.png)

## Where are repositories and logs stored?
All platform repositories, along with their respective logs, are stored in `/var/lib/quantum`. This directory is automatically created whether you deploy with or without Docker.

Please be aware that all information related to your Quantum instance and users will persist in this directory. If you opt to use the software's CLI and select "delete database and related", this directory will be emptied accordingly.

In the **.env file** or its **.env.example counterpart**, you'll encounter a variable named `NODE_ENV`, accepting either `production` or `development` as values. Based on this assignment, or any value you specify, a corresponding directory will be generated within `/var/lib/quantum` to house the persistent data associated with that particular execution mode.

For instance, **when NODE_ENV is set to development**, data like logs and user repositories will reside in `/var/lib/quantum/development/`. Conversely, **when NODE_ENV is production**, the data will be located in `/var/ lib/quantum/production`.

![Quantum Storage Directory](/screenshots/QuantumStorageDir.png)

The way platform content is managed within `/var/lib/quantum/` is quite simple. Well, the `containers` directory stores a list of directories where each of them will have as its name the **id of the user** to whom a respective container belongs. Let's remember that each user will have their own Docker instance where they can host their repositories, and in the `containers` directory there will be the directories of all the users registered on the platform. When you enter a container, it will house two directories, `github-repos` and `logs`, where in the `github-repos` directory all the user's cloned repositories will be stored (which are named after the id that they have in the database), while in the `logs` directory there will be the records associated with these repositories already mentioned as well as the records associated with the user's `Cloud Console` within the platform.

## What happens when the server is closed?
When initiating the shutdown of the host server (Quantum Server), it won't close immediately. Instead, upon detecting the shutdown signal, the server systematically shuts down all Docker instances belonging to users. Consequently, their deployments and repositories are also gracefully closed. Only after all Docker instances on the platform are safely shut down does the server proceed to shut down successfully.

Similarly, upon restarting the server, the platform bootloader takes charge of mounting all users' Docker instances during server runtime. Once these Docker instances are successfully started, the bootloader proceeds to launch the repositories of all users within their respective instances. Please note that this startup process may require a few minutes, depending on your hardware specifications and the number of users on the platform.

If a server crash occurs, it won't simply shut down. Instead, the error will be displayed in the console, and the server will promptly initiate an automatic restart. If the error persists and another occurrence happens, the server will persistently attempt to restart until it can do so successfully. This proactive approach is vital for security reasons; it ensures that deployments aren't compromised due to server issues without the user's awareness. Therefore, the server diligently strives to recover and restart after any crash, safeguarding the continuity of operations.

## We'd love your feedback and support!
Your involvement is vital to make Quantum the best it can be. Here's how you can get involved:

- **Contribute**: Explore the codebase on GitHub, fix bugs, implement new features, and become a part of the development team.
- **Star/Fork**: Increase Quantum's visibility on GitHub by starring and forking the repository. This helps others discover our project.
- **Coffee**: If Quantum has become a valuable tool for you, consider showing your appreciation with a small donation on Ko-fi https://ko-fi.com/codewithrodi. Your support fuels our team's continued development efforts.
