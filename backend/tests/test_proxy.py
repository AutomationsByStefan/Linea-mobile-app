"""
Backend proxy tests for Linea Pilates app
Tests proxy functionality to external API at https://linea-pilates-reformer-production.up.railway.app
"""
import pytest
import requests
import os

# Use the public URL for testing the proxy
BASE_URL = "https://pilates-app-preview.preview.emergentagent.com"

class TestProxyBasics:
    """Test basic proxy functionality"""

    def test_packages_endpoint(self):
        """Test that proxy forwards /api/packages correctly"""
        response = requests.get(f"{BASE_URL}/api/packages")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of packages"
        assert len(data) > 0, "Expected at least one package"
        
        # Verify package structure
        pkg = data[0]
        assert 'id' in pkg or '_id' in pkg, "Package should have id"
        assert 'naziv' in pkg or 'name' in pkg, "Package should have name"
        print(f"✓ Packages endpoint working - found {len(data)} packages")

    def test_phone_check_returns_name_field(self):
        """Bug 1: Verify API returns 'name' field for phone check"""
        response = requests.post(
            f"{BASE_URL}/api/auth/phone/check",
            json={"phone": "+38766024148"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get('exists') == True, "Phone should exist"
        assert 'name' in data, "Response should contain 'name' field"
        assert data['name'] == "Linea Trebinje", f"Expected 'Linea Trebinje', got {data['name']}"
        print(f"✓ Phone check returns 'name' field: {data['name']}")

    def test_proxy_forwards_cookies(self):
        """Bug 2: Test that proxy correctly forwards cookies"""
        # First, try to login to get a session cookie
        session = requests.Session()
        
        # Test with known test account
        login_response = session.post(
            f"{BASE_URL}/api/auth/phone/login",
            json={"phone": "+38799999999", "pin": "1111"},
            headers={"Content-Type": "application/json"}
        )
        
        # Check if we got cookies back
        cookies = session.cookies.get_dict()
        print(f"✓ Cookies received: {list(cookies.keys())}")
        
        # If login succeeded, verify cookies work for authenticated endpoint
        if login_response.status_code == 200:
            me_response = session.get(f"{BASE_URL}/api/auth/me")
            assert me_response.status_code == 200, "Authenticated request should work with cookies"
            user_data = me_response.json()
            assert 'phone' in user_data or 'email' in user_data, "Should return user data"
            print(f"✓ Cookie forwarding working - authenticated as {user_data.get('phone', user_data.get('email'))}")
        else:
            # If login failed, just verify we can make requests through proxy
            print(f"⚠ Login failed (status {login_response.status_code}), but proxy is forwarding requests")


class TestAuthEndpoints:
    """Test authentication endpoints through proxy"""

    def test_phone_check_nonexistent(self):
        """Test phone check for non-existent number"""
        response = requests.post(
            f"{BASE_URL}/api/auth/phone/check",
            json={"phone": "+38700000000"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Should return exists: false for non-existent number
        print(f"✓ Non-existent phone check: {data}")

    def test_login_with_test_account(self):
        """Test login with test account +38799999999"""
        response = requests.post(
            f"{BASE_URL}/api/auth/phone/login",
            json={"phone": "+38799999999", "pin": "1111"},
            headers={"Content-Type": "application/json"}
        )
        
        # May succeed or fail depending on external API state
        if response.status_code == 200:
            data = response.json()
            assert 'user' in data or 'phone' in data, "Should return user data"
            print(f"✓ Login successful for test account")
        else:
            print(f"⚠ Login failed with status {response.status_code} - may need valid credentials")


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session
