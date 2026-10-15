#!/usr/bin/env bash
set -euo pipefail

release="${1:?Pass the git commit SHA}"
source_dir="${2:-/opt/workhive/source}"
export WORKHIVE_RELEASE="$release"
# Keep Compose ownership stable when each GitHub push uses a new release directory.
# The first VM deployment was created from /opt/workhive/source (project "source").
export COMPOSE_PROJECT_NAME=source
cd "$source_dir"
test -s /opt/workhive/app.env

export DOCKER_BUILDKIT=1
docker build --secret id=workhive_env,src=/opt/workhive/app.env \
  --target builder -t "uc-workhive:builder-${release}" .
docker build --secret id=workhive_env,src=/opt/workhive/app.env \
  -t "uc-workhive:${release}" .

docker compose --profile migration \
  -f docker-compose.production.yml run --rm migrate

previous="$(docker image inspect uc-workhive:current --format '{{.Id}}' 2>/dev/null || true)"
docker tag "uc-workhive:${release}" uc-workhive:current
docker compose -f docker-compose.production.yml up -d --force-recreate

for attempt in $(seq 1 30); do
  if curl --fail --silent --output /dev/null http://127.0.0.1:8080/; then
    printf 'WorkHive deployment healthy at commit %s\n' "$release"
    docker image rm "uc-workhive:builder-${release}" >/dev/null 2>&1 || true
    docker image prune -f >/dev/null 2>&1 || true
    exit 0
  fi
  sleep 2
done

if [ -n "$previous" ]; then
  docker tag "$previous" uc-workhive:current
  docker compose -f docker-compose.production.yml up -d --force-recreate
fi
printf 'WorkHive did not pass its HTTP health check.\n' >&2
exit 1
