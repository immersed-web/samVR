# SamVR 
SamVR is a system for letting users create and share 3D environments. Users can enter the created 3D environments as avatars and interact with each other.
The system is implemented using web technologies. The client side consists of a website running in a browser.

Some of the key features:
- Visitors can use VR headset or desktop computer
- Creators can upload a 3D model (.glb) to be used as VR/3D environment
- Creators can upload assets in the form of 3D models, images, videos and documents and place them in the 3D environment.
- Visitors can enter the 3D evironment, where they can move around and talk to each other.
- Avatars in 3D evironment uses spatial audio so visitors can hear each other better when their avatars are standing close.

## Installation
> [!NOTE]
> **Prerequisites**: Initially you will need [Git](https://git-scm.com/) to be able to fetch the repository. Git is installed by default on most linux systems.
Additionally this project use the tool [Ansible](https://www.ansible.com/) to install, update, setup and deploy the project on a server.
To install ansible follow these instructions:
https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html

The project uses the Node.js version in the root `.nvmrc` (currently Node 24).
The environment playbook installs it with nvm. For local development, install
[nvm](https://github.com/nvm-sh/nvm) and run `nvm install` from the project
directory; in a new shell, run `nvm use` before starting project commands.
nvm also finds the root `.nvmrc` from project subdirectories.

### 1. Download the repository from github
To install SamVR and run it on your own server, you first need to retrieve the repository from github.
Using the terminal, go to your home folder on the server:
```
cd ~
```
Clone the repository from github and then go into the root directory of the project:
```
git clone https://github.com/immersed-web/samvr.git --recurse-submodules
cd samvr
```

### 2. Configure _.env_ file
This project relies on an .env file to configure relevant aspects of the system.
There is an example called `example.env` in the root folder of the project. This is just an example file. You need to create an .env file (the filename should be **.env**, only), and in this file provide the relevant settings. One way would be to make a copy of the example file with the name .env and change the settings in the new file:
```
cp example.env .env
```
- I strongly advice against using dollarsigns (`$`) anywhere in the .env file as that might fuck up everything (`$` is used for variables in linux/bash/shells).
- Should probably be careful with backslash (`\`) too.

A normal setup would require setting values for:
- EXPOSED_SERVER_URL
- LISTEN_IP
- setting INTERNAL_IP, or possibly, commenting it out
- DATABASE_PASSWORD
- SESSION_KEY
- ADMIN_PASSWORD
- JWT_SECRET


The rest could be left as is.

### 3. Install and setup all da thingz!
You'll need the tool __Ansible__ in order to follow this step. Follow the installation instructions for installing ansible [here](https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html) and come back when you have Ansible successfully installed on the server.

Now let's install and setup everything.
cd into the ansible folder where all the playbook files are:
```bash
cd ansible
```
Setup all the system wide tools and dependencies. The -K argument makes the script prompt for user password when permission escalation (sudo) is required.
```bash
ansible-playbook setup_environment.yml -K
```

__Log off and log back in__. This is needed because the previous script (setup_environment.yml) added some environment variables to the user/profile (.bashrc or equivalent) that only gets loaded when the shell starts. Alternatively, you can manually "source" the shell config manually. e.g. `source ~/.bashrc`, but it's probably more reliable to log off and on again.

Install the internal project dependencies and build the apps
```bash
ansible-playbook setup_project.yml -K
```

### 4. Now let's run the project 🚀:
Go back to project root folder
```bash
cd ..
```
Select the project Node version and run pm2 process manager in the project root (pm2 will pick up the file named ecosystem.config.js in the root, which specifies how to start and run the required processes)
```bash
nvm use
pm2 start
```

### 5. Log in as the seeded god user
Visit the webapplication and log in. 🚀
username: **överchefen**
password: **`<ADMIN_PASSWORD you have configured in the .env file earlier>`**

## Update to new version
- start in project root
- stop all the processes and the existing PM2 daemon: `pm2 delete all` then `pm2 kill`
- go to ansible directory: `cd ansible`
- run the update script: `ansible-playbook dangerous_sync_to_github_version.yml`
- for good measure run: `ansible-playbook setup_environment.yml` (should usually not be needed, but in rare cases some edits are made to the environment/global dependencies)
- run the project setup: `ansible-playbook setup_project.yml`
- go to project root directory: `cd ..`
- select the project Node version: `nvm use`
- verify the selected version with `node --version`, then start the processes: `pm2 start`

Stopping the PM2 daemon is important when upgrading Node: otherwise an existing
daemon can continue running with the previous Node environment. Verify the
running processes after restarting with `pm2 list` and `pm2 logs`.

> [!NOTE]
> Note: The file is named **dangerous**_sync_to_github_version.yml because it throws away any local additions/edits to the codebase (including not yet pushed commits). Thus it's only "dangerous" for a development environment and not a production server simply running the application.


## Monitoring
The applications are run with a tool called pm2 that gets installed by the `setup-environment.yml` ansible script. You can interact directly with pm2 using the command line. Here's a few examples:

To list the processes managed by pm2 and their status:
```
pm2 ls
```

To have a real-time look at what the applications are printing to the console while running, run:
```
pm2 logs
```

To do the same for only one running process, append the name. For example:
```
pm2 logs mediaserver
```

To get a terminal based overview dashboard, run:
```
pm2 monit
```

## Ports
The following ports are required to be opened on the server:

| Ports | Protocol  | Description |
| -------: | -------: | :----- |
| 22    | TCP       | If you need to SSH in to the server (you will) |
| 80    | TCP       | Serve standard http requests |
| 443   | TCP       | Serve standard https requests |
| 40000-49999 | UDP and TCP | ports for the SFU mediaserver (UDP preferred; TCP fallback) |

## Docker Compose deployment

The default Compose configuration remains database-only for local development:

```bash
docker compose up -d
```

For a Linux production host, the `deploy` profile also starts auth, fileserver,
mediaserver and Caddy. Caddy serves the built frontend and proxies the APIs;
the mediaserver uses host networking for WebRTC. Docker Engine and the Compose
plugin are required. This deployment is separate from the PM2/Ansible process
setup above: stop any existing PM2 services before starting it, since they use
the same ports. The existing Compose Postgres service and its data are reused.

1. Initialize the submodule with `git submodule update --init --recursive`.
2. Configure `.env`, including the public domain, database credentials, session
   and JWT secrets, and `ADMIN_PASSWORD`. Set `LISTEN_IP` to the public IP and
   `INTERNAL_IP` to an IP assigned to the host. The Compose deployment forces
   production mode (`EXPOSED_LOCAL=false`). The Caddy paths and the frontend
   paths are taken from the same `EXPOSED_*_PATH` settings.
3. Point the domain at the host and open ports 80 and 443 (TCP), 443 (UDP for
   HTTP/3), and 40000–49999 (UDP and TCP) in the host and cloud firewalls.
   Caddy obtains HTTPS certificates for the configured domain.
4. Build and start the stack:

   ```bash
   docker compose --profile deploy up -d --build
   ```

   The migration service waits for Postgres, applies migrations and seeds the
   initial admin before the application services start. Log in as `överchefen`
   with the `ADMIN_PASSWORD` used when seeding. Re-running the seed leaves an
   existing account unchanged; changing `ADMIN_PASSWORD` does not change its
   stored password.

Use `docker compose --profile deploy ps` and `docker compose --profile deploy
logs -f` to inspect the deployment. Rebuild and recreate the stack with the
same `up -d --build` command after updates; frontend `EXPOSED_*` values are
compiled into the frontend image, so rebuild when changing them. For an
explicit migration and seed run, use `docker compose --profile deploy run --rm migrate`.

The fileserver uses the `uploads` volume, while Caddy's certificate and config
data use `caddy_data` and `caddy_config`. Existing host-based uploads under
`backend/fileserver/uploads` are not automatically imported into the volume;
copy them before switching an existing installation. Back up both the database
and uploads before migration. Avoid `docker compose down -v` unless you intend
to delete the Compose-managed data volumes.

## Credit
The project to develop and create this software was initiated by Lèv Grunberg.
The development was a collaboration between the following organisations:
- Reasearch Institutes of Sweden (RISE)
- Kungsbacka Kommun

3D models created by:
- Nisa Tokmak
- Jenny-Li Levin

## Copyright & License
This codebase (excluding external dependencies, such as libraries and/or software frameworks) is written by Gunnar Oledal & Martin Törnros. The project is licensed under MIT. The license text can be found in the file LICENSE in the project root.
External dependencies, such as libraries and/or software frameworks in this repository, holds up to their own respective licenses.
