import pytest
from rest_framework.test import APIClient

from leads.models import Lead, LeadActivity

pytestmark = pytest.mark.django_db


# --- create / validation ---------------------------------------------------

def test_create_lead_sets_owner_and_logs_activity(api, user):
    response = api.post(
        "/api/leads/",
        {"name": "  Ali Valiyev ", "phone": "+998 90 123-45-67", "source": "website"},
        format="json",
    )
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Ali Valiyev"
    assert body["phone"] == "+998901234567"
    assert body["status"] == "new"
    assert body["owner"]["id"] == user.id
    assert LeadActivity.objects.filter(lead_id=body["id"], action="created").exists()


def test_create_requires_email_or_phone(api):
    response = api.post("/api/leads/", {"name": "No Contact"}, format="json")
    assert response.status_code == 400
    assert "non_field_errors" in response.json()["error"]["details"]


@pytest.mark.parametrize(
    "payload, field",
    [
        ({"name": "Ok Name", "email": "not-an-email"}, "email"),
        ({"name": "Ok Name", "phone": "12"}, "phone"),
        ({"name": "Ok Name", "email": "a@b.com", "source": "tv"}, "source"),
        ({"name": "Ok Name", "email": "a@b.com", "status": "archived"}, "status"),
        ({"name": "A", "email": "a@b.com"}, "name"),
    ],
)
def test_create_validation_errors(api, payload, field):
    response = api.post("/api/leads/", payload, format="json")
    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert field in error["details"]


def test_patch_cannot_remove_last_contact(api, make_lead):
    lead = make_lead(email="only@example.com", phone="")
    response = api.patch(f"/api/leads/{lead.id}/", {"email": ""}, format="json")
    assert response.status_code == 400


# --- list / search / filter / sort / pagination -----------------------------

def test_list_pagination_shape(api, make_lead):
    for i in range(15):
        make_lead(name=f"Lead {i:02d}")
    response = api.get("/api/leads/?page=2&page_size=10")
    body = response.json()
    assert response.status_code == 200
    assert body["count"] == 15
    assert body["page"] == 2
    assert body["total_pages"] == 2
    assert len(body["results"]) == 5


def test_page_size_is_capped(api, make_lead):
    make_lead()
    assert api.get("/api/leads/?page_size=1000").json()["page_size"] == 100


def test_invalid_page_returns_404(api, make_lead):
    make_lead()
    assert api.get("/api/leads/?page=99").status_code == 404


def test_search_by_name_email_phone(api, make_lead):
    make_lead(name="Jasur Karimov", email="jasur@mail.uz")
    make_lead(name="Other", email="x@mail.uz", phone="+998711112233")
    assert api.get("/api/leads/?search=jasur").json()["count"] == 1
    assert api.get("/api/leads/?search=711112233").json()["count"] == 1


def test_filter_by_multiple_statuses(api, make_lead):
    make_lead(status="new")
    make_lead(status="won")
    make_lead(status="lost")
    assert api.get("/api/leads/?status=won&status=lost").json()["count"] == 2
    assert api.get("/api/leads/?status=bogus").status_code == 400


def test_ordering_by_name(api, make_lead):
    for name in ("Charlie", "Alice", "Bob"):
        make_lead(name=name)
    names = [r["name"] for r in api.get("/api/leads/?ordering=name").json()["results"]]
    assert names == ["Alice", "Bob", "Charlie"]


# --- status / activity ------------------------------------------------------

def test_change_status_logs_activity(api, make_lead):
    lead = make_lead()
    response = api.post(f"/api/leads/{lead.id}/status/", {"status": "qualified"}, format="json")
    assert response.status_code == 200
    assert response.json()["status"] == "qualified"

    activity = lead.activities.first()
    assert activity.action == "status_changed"
    assert activity.changes == {"status": {"from": "new", "to": "qualified"}}


def test_change_to_same_status_is_rejected(api, make_lead):
    lead = make_lead()
    response = api.post(f"/api/leads/{lead.id}/status/", {"status": "new"}, format="json")
    assert response.status_code == 400


def test_update_records_field_diff(api, make_lead):
    lead = make_lead(note="")
    api.patch(f"/api/leads/{lead.id}/", {"note": "Call on Monday"}, format="json")
    activities = api.get(f"/api/leads/{lead.id}/activities/").json()["results"]
    assert activities[0]["action"] == "updated"
    assert activities[0]["changes"]["note"] == {"from": "", "to": "Call on Monday"}


def test_noop_update_does_not_log(api, make_lead):
    lead = make_lead(name="Same")
    api.patch(f"/api/leads/{lead.id}/", {"name": "Same"}, format="json")
    assert lead.activities.count() == 1  # only "created"


# --- delete permissions -----------------------------------------------------

def test_non_owner_cannot_delete(make_lead, other_user):
    lead = make_lead()
    client = APIClient()
    client.force_authenticate(other_user)
    assert client.delete(f"/api/leads/{lead.id}/").status_code == 403
    # ...but can still read and edit (shared pipeline)
    assert client.patch(f"/api/leads/{lead.id}/", {"note": "x"}, format="json").status_code == 200


def test_owner_can_delete(api, make_lead):
    lead = make_lead()
    assert api.delete(f"/api/leads/{lead.id}/").status_code == 204
    assert not Lead.objects.filter(id=lead.id).exists()


def test_unknown_lead_returns_404(api):
    response = api.get("/api/leads/999999/")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


# --- stats ------------------------------------------------------------------

def test_stats(api, make_lead):
    make_lead(status="won", source="ads")
    make_lead(status="won", source="ads")
    make_lead(status="lost", source="website")
    make_lead(status="new", source="website")
    body = api.get("/api/leads/stats/").json()
    assert body["total"] == 4
    assert body["conversion_rate"] == pytest.approx(66.7)
    by_status = {row["key"]: row["count"] for row in body["by_status"]}
    assert by_status == {"new": 1, "contacted": 0, "qualified": 0, "won": 2, "lost": 1}
    assert len(body["daily"]) == 30
    assert body["daily"][-1]["count"] == 4


def test_owner_change_is_logged_with_display_name(api, make_lead, other_user):
    lead = make_lead()
    api.patch(f"/api/leads/{lead.id}/", {"owner_id": other_user.id}, format="json")
    change = lead.activities.first().changes["owner"]
    assert change == {"from": "manager", "to": "other"}
