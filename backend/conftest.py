import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient


@pytest.fixture(autouse=True)
def _allow_testserver(settings):
    settings.ALLOWED_HOSTS = ["testserver"]


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user("manager", password="pass12345")


@pytest.fixture
def other_user(db):
    return get_user_model().objects.create_user("other", password="pass12345")


@pytest.fixture
def api(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def make_lead(user):
    from leads import services

    def _make(actor=None, **overrides):
        data = {"name": "Test Lead", "email": "lead@example.com", **overrides}
        return services.create_lead(data=data, actor=actor or user)

    return _make
