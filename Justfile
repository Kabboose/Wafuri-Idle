set shell := ["bash", "-lc"]

nvm := "source ~/.nvm/nvm.sh && nvm use"
server_env := "server/.env"
server_env_example := "server/.env.example"
compose := "docker compose"

default:
  @just --list

doctor:
  {{nvm}} && node -v && npm -v && ~/.local/bin/just --version

hooks-install:
  git config --local core.hooksPath .githooks
  chmod +x .githooks/pre-commit .githooks/pre-push

check-docker:
  @command -v docker >/dev/null 2>&1 || (echo "docker is required for this recipe" && exit 1)
  @docker compose version >/dev/null 2>&1 || (echo "docker compose is required for this recipe" && exit 1)

env:
  if [ ! -f {{server_env}} ]; then cp {{server_env_example}} {{server_env}}; fi

infra-up: check-docker
  {{compose}} up -d postgres redis

wait-db: check-docker
  until {{compose}} exec -T postgres pg_isready -U postgres -d wafuri_idle >/dev/null 2>&1; do sleep 1; done

wait-redis: check-docker
  until {{compose}} exec -T redis redis-cli ping | grep -q PONG; do sleep 1; done

wait-services:
  just wait-db
  just wait-redis

infra-down: check-docker
  {{compose}} down

setup:
  just env
  just infra-up
  just wait-services
  {{nvm}} && npm install
  {{nvm}} && npm run prisma:generate
  {{nvm}} && npm run prisma:migrate

install:
  {{nvm}} && npm install

prisma-generate:
  {{nvm}} && npm run prisma:generate

prisma-migrate:
  {{nvm}} && npm run prisma:migrate -- --name auto

build:
  {{nvm}} && npm run build

lint:
  {{nvm}} && npm run lint

test:
  just lint
  {{nvm}} && npm run test --workspace server
  {{nvm}} && npm run build --workspace client

server-build:
  {{nvm}} && npm run build --workspace server

client-build:
  {{nvm}} && npm run build --workspace client

server-test:
  {{nvm}} && npm run test --workspace server

client-test:
  {{nvm}} && npm run build --workspace client

server:
  {{nvm}} && npm run dev --workspace server

client:
  {{nvm}} && npm run dev --workspace client

run:
  just setup
  {{nvm}} && npm run dev --workspace server & SERVER_PID=$!; npm run dev --workspace client; STATUS=$?; kill $SERVER_PID; wait $SERVER_PID 2>/dev/null; exit $STATUS
