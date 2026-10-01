import django_filters

from .models import Lead, LeadSource, LeadStatus


class LeadFilter(django_filters.FilterSet):
    # ?status=new&status=contacted  -> leads in either status
    status = django_filters.MultipleChoiceFilter(choices=LeadStatus.choices)
    source = django_filters.MultipleChoiceFilter(choices=LeadSource.choices)
    owner = django_filters.NumberFilter(field_name="owner_id")
    created_after = django_filters.DateFilter(field_name="created_at", lookup_expr="date__gte")
    created_before = django_filters.DateFilter(field_name="created_at", lookup_expr="date__lte")

    class Meta:
        model = Lead
        fields = ("status", "source", "owner", "created_after", "created_before")
