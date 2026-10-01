"""Business logic for leads.

Views stay thin: they validate input with serializers and call these
functions. Every write goes through here so the activity log can never be
skipped, and the lead change + its log entry are saved in one transaction.
"""

from datetime import timedelta

from django.db import transaction
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone

from .models import Lead, LeadActivity, LeadSource, LeadStatus

TRACKED_FIELDS = ("name", "email", "phone", "source", "status", "note", "owner")


def _snapshot(lead: Lead) -> dict:
    snap = {field: getattr(lead, field) for field in TRACKED_FIELDS if field != "owner"}
    # Store the owner's display name so history stays readable even if the user is deleted.
    snap["owner"] = (lead.owner.get_full_name() or lead.owner.username) if lead.owner else None
    return snap


def _diff(before: dict, after: dict) -> dict:
    return {
        field: {"from": before[field], "to": after[field]}
        for field in TRACKED_FIELDS
        if before[field] != after[field]
    }


@transaction.atomic
def create_lead(*, data: dict, actor) -> Lead:
    data.setdefault("owner", actor)
    lead = Lead.objects.create(**data)
    LeadActivity.objects.create(
        lead=lead,
        actor=actor,
        action=LeadActivity.Action.CREATED,
        changes={"status": {"from": None, "to": lead.status}},
    )
    return lead


@transaction.atomic
def update_lead(*, lead: Lead, data: dict, actor) -> Lead:
    before = _snapshot(lead)
    for field, value in data.items():
        setattr(lead, field, value)
    lead.save()

    changes = _diff(before, _snapshot(lead))
    if changes:
        action = (
            LeadActivity.Action.STATUS_CHANGED
            if set(changes) == {"status"}
            else LeadActivity.Action.UPDATED
        )
        LeadActivity.objects.create(lead=lead, actor=actor, action=action, changes=changes)
    return lead


def change_status(*, lead: Lead, status: str, actor) -> Lead:
    return update_lead(lead=lead, data={"status": status}, actor=actor)


def get_stats(queryset=None) -> dict:
    qs = queryset if queryset is not None else Lead.objects.all()
    now = timezone.now()

    # .order_by() clears Meta.ordering, otherwise created_at leaks into GROUP BY.
    grouped = qs.order_by()
    status_counts = dict(grouped.values("status").annotate(c=Count("id")).values_list("status", "c"))
    source_counts = dict(grouped.values("source").annotate(c=Count("id")).values_list("source", "c"))

    won = status_counts.get(LeadStatus.WON, 0)
    lost = status_counts.get(LeadStatus.LOST, 0)
    closed = won + lost

    # Start of the local day 29 days ago, so the window is exactly 30 local days.
    since = timezone.localtime(now).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=29)
    daily_rows = (
        grouped.filter(created_at__gte=since)
        .annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(count=Count("id"))
    )
    per_day = {row["day"]: row["count"] for row in daily_rows}
    start = timezone.localdate(now) - timedelta(days=29)
    daily = [
        {"date": start + timedelta(days=i), "count": per_day.get(start + timedelta(days=i), 0)}
        for i in range(30)
    ]

    return {
        "total": qs.count(),
        "new_this_week": qs.filter(created_at__gte=now - timedelta(days=7)).count(),
        "conversion_rate": round(won / closed * 100, 1) if closed else 0.0,
        "by_status": [
            {"key": s.value, "label": s.label, "count": status_counts.get(s.value, 0)}
            for s in LeadStatus
        ],
        "by_source": [
            {"key": s.value, "label": s.label, "count": source_counts.get(s.value, 0)}
            for s in LeadSource
        ],
        "daily": daily,
    }
