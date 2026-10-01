import re

from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Lead, LeadActivity, LeadStatus

User = get_user_model()


class UserShortSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "username", "full_name")

    def get_full_name(self, obj) -> str:
        return obj.get_full_name() or obj.username


class LeadSerializer(serializers.ModelSerializer):
    owner = UserShortSerializer(read_only=True)
    owner_id = serializers.PrimaryKeyRelatedField(
        source="owner",
        queryset=User.objects.filter(is_active=True),
        write_only=True,
        required=False,
        allow_null=True,
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    source_display = serializers.CharField(source="get_source_display", read_only=True)

    class Meta:
        model = Lead
        fields = (
            "id",
            "name",
            "email",
            "phone",
            "source",
            "source_display",
            "status",
            "status_display",
            "note",
            "owner",
            "owner_id",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_name(self, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError("Name must be at least 2 characters.")
        return value

    def validate_email(self, value: str) -> str:
        return value.strip().lower()

    def validate_phone(self, value: str) -> str:
        # Store a normalized form: keep leading '+' and digits only.
        value = value.strip()
        if not value:
            return value
        normalized = ("+" if value.startswith("+") else "") + re.sub(r"\D", "", value)
        digits = len(normalized.lstrip("+"))
        if not 7 <= digits <= 15:
            raise serializers.ValidationError("Phone must contain 7-15 digits.")
        return normalized

    def validate(self, attrs):
        # On PATCH only some fields are sent, so merge with current values.
        email = attrs.get("email", getattr(self.instance, "email", ""))
        phone = attrs.get("phone", getattr(self.instance, "phone", ""))
        if not email and not phone:
            raise serializers.ValidationError(
                {"non_field_errors": ["Provide at least an email or a phone number."]}
            )
        return attrs


class LeadStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=LeadStatus.choices)

    def validate_status(self, value):
        lead = self.context["lead"]
        if lead.status == value:
            raise serializers.ValidationError(f"Lead is already '{lead.get_status_display()}'.")
        return value


class LeadActivitySerializer(serializers.ModelSerializer):
    actor = UserShortSerializer(read_only=True)
    action_display = serializers.CharField(source="get_action_display", read_only=True)

    class Meta:
        model = LeadActivity
        fields = ("id", "action", "action_display", "actor", "changes", "created_at")


class CountItemSerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
    count = serializers.IntegerField()


class DailyCountSerializer(serializers.Serializer):
    date = serializers.DateField()
    count = serializers.IntegerField()


class LeadStatsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    new_this_week = serializers.IntegerField()
    conversion_rate = serializers.FloatField(help_text="won / (won + lost), percent")
    by_status = CountItemSerializer(many=True)
    by_source = CountItemSerializer(many=True)
    daily = DailyCountSerializer(many=True, help_text="Leads created per day, last 30 days")
