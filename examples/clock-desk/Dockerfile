FROM node:22.23.5-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends git \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /srv/agent
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force && rm -rf /root/.npm
COPY . .
# The harness walks up to the nearest git root. Without one it walks the
# whole image, including node_modules, on every turn. bot/ is that root.
# node_modules stays beside it, outside the walk.
RUN mkdir -p /srv/agent/bot /var/lib/agent-sdk \
 && git init --quiet /srv/agent/bot \
 && chown -R node:node /srv/agent/bot /var/lib/agent-sdk \
 && printf '%s\n' \
    '#!/bin/sh' \
    'set -e' \
    'mkdir -p /var/lib/agent-sdk /home/node' \
    'if [ "$(id -u)" = "0" ]; then' \
    '  chown -R node:node /var/lib/agent-sdk /home/node' \
    '  export HOME=/home/node' \
    '  exec setpriv --reuid=node --regid=node --init-groups -- "$0"' \
    'fi' \
    'if [ -n "$AGENT_SDK_BEARER_TOKEN" ] && [ "$BIGAGENT_ADMIT_LOCAL" != "1" ]; then' \
    '  exec ./node_modules/.bin/agent-sdk serve --dir /srv/agent --host 0.0.0.0 --port 3000 --state-root /var/lib/agent-sdk --mode single --bearer-token "$AGENT_SDK_BEARER_TOKEN"' \
    'fi' \
    'exec ./node_modules/.bin/agent-sdk serve --dir /srv/agent --host 0.0.0.0 --port 3000 --state-root /var/lib/agent-sdk --mode single --allow-anonymous' \
    > /usr/local/bin/agent-start \
 && chmod 755 /usr/local/bin/agent-start
ENV NODE_ENV=production
EXPOSE 3000
# Compose mounts a root-owned volume on /var/lib/agent-sdk. The script gives
# that directory to node and only then starts serve. A bearer locks the API.
# BIGAGENT_ADMIT_LOCAL=1 admits this machine.
CMD ["/usr/local/bin/agent-start"]
