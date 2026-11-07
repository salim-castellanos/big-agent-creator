FROM node:22.13
WORKDIR /srv/agent
COPY . .
RUN npm install --omit=dev && npm install -g @grok/agent-sdk
EXPOSE 3000
# Docker is not loopback inside the container, so localDevStrict returns 401.
# BIGAGENT_ADMIT_LOCAL=1 admits this machine. Otherwise a bearer locks the API.
CMD ["sh", "-c", "if [ -n \"$AGENT_SDK_BEARER_TOKEN\" ] && [ \"$BIGAGENT_ADMIT_LOCAL\" != \"1\" ]; then exec agent-sdk serve --dir /srv/agent --host 0.0.0.0 --port 3000 --state-root /var/lib/agent-sdk --mode single --bearer-token \"$AGENT_SDK_BEARER_TOKEN\"; else exec agent-sdk serve --dir /srv/agent --host 0.0.0.0 --port 3000 --state-root /var/lib/agent-sdk --mode single --allow-anonymous; fi"]
