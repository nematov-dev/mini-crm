import pytest
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


def test_leads_require_authentication():
    response = APIClient().get("/api/leads/")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "not_authenticated"


def test_login_returns_jwt_and_token_works(user):
    client = APIClient()
    response = client.post(
        "/api/auth/login/", {"username": "manager", "password": "pass12345"}, format="json"
    )
    assert response.status_code == 200
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
    me = client.get("/api/auth/me/")
    assert me.status_code == 200
    assert me.json()["username"] == "manager"


def test_login_with_wrong_password(user):
    response = APIClient().post(
        "/api/auth/login/", {"username": "manager", "password": "wrong"}, format="json"
    )
    assert response.status_code == 401
