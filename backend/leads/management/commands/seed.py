"""Create demo users and leads.

    python manage.py seed            # 60 leads
    python manage.py seed --leads 200 --reset
"""

import random
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from leads import services
from leads.models import Lead, LeadSource, LeadStatus

FIRST = ["Ali", "Jasur", "Dilnoza", "Madina", "Bekzod", "Aziz", "Nilufar", "Sardor", "Kamola", "Otabek"]
LAST = ["Karimov", "Valiyeva", "Toshmatov", "Rahimova", "Yusupov", "Ergasheva", "Nazarov", "Saidova"]
NOTES = ["", "Asked for a price list.", "Call back next week.", "Interested in the annual plan.",
         "Met at the expo.", "Wants a demo for the team."]

# New/Contacted are common, Won/Lost rarer -> a realistic funnel.
STATUS_WEIGHTS = {
    LeadStatus.NEW: 30, LeadStatus.CONTACTED: 25, LeadStatus.QUALIFIED: 20,
    LeadStatus.WON: 15, LeadStatus.LOST: 10,
}
FUNNEL = [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUALIFIED]


class Command(BaseCommand):
    help = "Seed demo users (admin/admin12345, manager/manager12345) and leads."

    def add_arguments(self, parser):
        parser.add_argument("--leads", type=int, default=60)
        parser.add_argument("--reset", action="store_true", help="Delete existing leads first.")

    @transaction.atomic
    def handle(self, *args, leads, reset, **options):
        User = get_user_model()
        admin, created = User.objects.get_or_create(
            username="admin", defaults={"is_staff": True, "is_superuser": True, "first_name": "Admin"}
        )
        if created:
            admin.set_password("admin12345")
            admin.save()
        manager, created = User.objects.get_or_create(
            username="manager", defaults={"first_name": "Sales", "last_name": "Manager"}
        )
        if created:
            manager.set_password("manager12345")
            manager.save()

        if reset:
            Lead.objects.all().delete()

        rng = random.Random(42)
        now = timezone.now()
        for _ in range(leads):
            first, last = rng.choice(FIRST), rng.choice(LAST)
            actor = rng.choice([admin, manager])
            lead = services.create_lead(
                data={
                    "name": f"{first} {last}",
                    "email": f"{first}.{last}{rng.randint(1, 999)}@example.com".lower()
                    if rng.random() > 0.2 else "",
                    "phone": f"+99890{rng.randint(1000000, 9999999)}",
                    "source": rng.choice(LeadSource.values),
                    "note": rng.choice(NOTES),
                },
                actor=actor,
            )
            target = rng.choices(list(STATUS_WEIGHTS), weights=list(STATUS_WEIGHTS.values()))[0]
            # Walk the funnel step by step so the activity history looks real:
            # e.g. target=won -> contacted, qualified, won.
            path = FUNNEL[: FUNNEL.index(target) + 1] if target in FUNNEL else FUNNEL + [target]
            for step in path[1:]:
                services.change_status(lead=lead, status=step, actor=actor)

            # Spread creation dates over the last 30 days for the dashboard chart.
            created_at = now - timedelta(days=rng.randint(0, 29), hours=rng.randint(0, 23))
            Lead.objects.filter(pk=lead.pk).update(created_at=created_at, updated_at=created_at)
            for i, activity in enumerate(lead.activities.order_by("id")):
                activity.created_at = min(created_at + timedelta(hours=i * 5), now)
                activity.save(update_fields=["created_at"])

        self.stdout.write(self.style.SUCCESS(
            f"Seeded {leads} leads. Logins: admin/admin12345, manager/manager12345"
        ))
