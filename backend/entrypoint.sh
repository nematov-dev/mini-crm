#!/bin/sh
set -e

python manage.py migrate --noinput

if [ "$SEED_DEMO_DATA" = "true" ] && [ "$(python manage.py shell -c 'from leads.models import Lead; print(Lead.objects.exists())')" = "False" ]; then
  python manage.py seed
fi

exec "$@"
