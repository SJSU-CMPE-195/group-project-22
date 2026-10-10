import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_fetch_page_no_url(client):
    response = client.post('/fetch-page', json={})
    assert response.status_code == 400

def test_fetch_page_empty_string(client):
    response = client.post('/fetch-page', json={'url': ''})
    assert response.status_code == 400

def test_fetch_page_invalid_url(client):
    response = client.post('/fetch-page', json={'url': 'notaurl'})
    assert response.status_code == 400

def test_fetch_page_valid_url(client):
    response = client.post('/fetch-page', json={'url': 'https://example.com'})
    assert response.status_code == 200
    assert response.content_type == 'application/pdf'
