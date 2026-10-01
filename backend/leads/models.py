from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models
from django.db.models import Q

phone_validator = RegexValidator(
    regex=r"^\+?[0-9\s\-()]{7,20}$",
    message="Phone must contain 7-20 digits and may start with '+'.",
)


class LeadStatus(models.TextChoices):
    NEW = "new", "New"
    CONTACTED = "contacted", "Contacted"
    QUALIFIED = "qualified", "Qualified"
    WON = "won", "Won"
    LOST = "lost", "Lost"


class LeadSource(models.TextChoices):
    WEBSITE = "website", "Website"
    REFERRAL = "referral", "Referral"
    SOCIAL = "social", "Social media"
    ADS = "ads", "Advertising"
    COLD_CALL = "cold_call", "Cold call"
    EVENT = "event", "Event"
    OTHER = "other", "Other"


class Lead(models.Model):
    name = models.CharField(max_length=150)
    email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=20, blank=True, default="", validators=[phone_validator])
    source = models.CharField(max_length=20, choices=LeadSource.choices, default=LeadSource.OTHER)
    status = models.CharField(max_length=20, choices=LeadStatus.choices, default=LeadStatus.NEW)
    note = models.TextField(blank=True, default="")

    # The manager responsible for the lead (defaults to whoever created it).
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="leads",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["-created_at"]),
            models.Index(fields=["source"]),
        ]
        constraints = [
            # A lead is useless without a way to reach it.
            models.CheckConstraint(
                condition=~Q(email="") | ~Q(phone=""),
                name="lead_has_email_or_phone",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.get_status_display()})"


class LeadActivity(models.Model):
    """Append-only audit log of what happened to a lead."""

    class Action(models.TextChoices):
        CREATED = "created", "Created"
        UPDATED = "updated", "Updated"
        STATUS_CHANGED = "status_changed", "Status changed"

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="activities")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="lead_activities",
    )
    action = models.CharField(max_length=20, choices=Action.choices)
    # {"field": {"from": old, "to": new}, ...}
    changes = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["lead", "-created_at"])]
        verbose_name_plural = "lead activities"

    def __str__(self) -> str:
        return f"{self.lead_id}: {self.action} at {self.created_at:%Y-%m-%d %H:%M}"
