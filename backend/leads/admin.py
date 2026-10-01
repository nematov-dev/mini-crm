from django.contrib import admin

from .models import Lead, LeadActivity


class LeadActivityInline(admin.TabularInline):
    model = LeadActivity
    extra = 0
    readonly_fields = ("action", "actor", "changes", "created_at")
    can_delete = False


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "phone", "source", "status", "owner", "created_at")
    list_filter = ("status", "source")
    search_fields = ("name", "email", "phone")
    inlines = [LeadActivityInline]


@admin.register(LeadActivity)
class LeadActivityAdmin(admin.ModelAdmin):
    list_display = ("lead", "action", "actor", "created_at")
    list_filter = ("action",)
