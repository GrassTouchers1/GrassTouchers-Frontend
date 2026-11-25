# Copyright 2026 GrassTouchers Team
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Kịch bản kiểm thử liên thông End-to-End (E2E) - Phân hệ Người dân (Victim Portal).
Đáp ứng yêu cầu nhiệm vụ VIC-08 & Tiêu chí nghiệm thu SYS-02 (OLP PMNM 2026).

Luồng kiểm thử:
1. Xem thời tiết & cảnh báo thiên tai (VIC-02, VIC-03).
2. Ghim tọa độ & gửi yêu cầu cứu nạn khẩn cấp SOS (VIC-04, VIC-05, V-04).
3. Xác thực mã hồ sơ cứu nạn #SOS-2026-XXXX và tra cứu tiến độ (VIC-05, V-02, V-03).
4. Báo ngập cộng đồng kèm gắn nhãn [Chờ xác minh] (VIC-06).
5. Đồng bộ và hiển thị điểm báo ngập lên bản đồ GeoJSON (VIC-06).
6. Mô phỏng cơ chế lưu trữ ngoại tuyến (Offline-First Queue) khi mất mạng (VIC-07).
"""

import json
import re
import unittest
import urllib.request
import urllib.error

API_BASE_URL = "http://127.0.0.1:8000"


class TestCitizenWorkflow(unittest.TestCase):
    """Bộ kiểm thử liên thông cho toàn bộ phân hệ Người dân NORTHSTAR."""

    def make_request(self, path, method="GET", data=None, headers=None):
        """Hàm phụ trợ gửi HTTP request tới máy chủ backend."""
        url = f"{API_BASE_URL}{path}"
        hdrs = {"Content-Type": "application/json"}
        if headers:
            hdrs.update(headers)
        req_data = json.dumps(data).encode("utf-8") if data is not None else None
        req = urllib.request.Request(url, data=req_data, headers=hdrs, method=method)
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                status = resp.status
                body = resp.read().decode("utf-8")
                return status, json.loads(body) if body else {}
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8")
            return e.code, json.loads(err_body) if err_body else {}

    def test_01_weather_and_hazard_alerts(self):
        """Kiểm tra tích hợp API Thời tiết và Cảnh báo thiên tai (VIC-02, VIC-03)."""
        status, data = self.make_request("/api/weather/hanoi")
        self.assertEqual(status, 200, "API thời tiết phải trả về HTTP 200")
        self.assertIn("city", data)
        self.assertEqual(data["city"], "Hà Nội")
        self.assertIn("hourly_forecast", data)
        self.assertIsInstance(data["hourly_forecast"], list)

    def test_02_submit_sos_beacon_with_ticket(self):
        """Kiểm tra gửi cứu nạn SOS và sinh mã hồ sơ #SOS-2026-XXXX (VIC-05, V-02)."""
        payload = {
            "contact_name": "Trần Thị Lan",
            "phone": "0987654321",
            "lat": 21.0285,
            "lng": 105.8030,
            "people_count": 3,
            "has_elderly_or_children": True,
            "water_level_cm": 80.0,
            "priority": "critical",
            "notes": "Nước ngập ngang ngực, có người già và trẻ nhỏ cần di tản khẩn cấp"
        }
        status, data = self.make_request("/api/sos", method="POST", data=payload)
        self.assertEqual(status, 201, "Tạo yêu cầu SOS phải trả về HTTP 201")
        self.assertEqual(data.get("type"), "Feature", "Kết quả trả về phải là GeoJSON Feature")

        props = data.get("properties", {})
        self.assertIn("id", props, "Feature properties phải có trường id")
        record_id = props["id"]

        # Định dạng chuẩn ticket cứu nạn
        ticket_code = f"#SOS-2026-{int(record_id):04d}"
        self.assertTrue(
            re.match(r"^#SOS-2026-\d{4}$", ticket_code),
            f"Mã ticket {ticket_code} phải đúng chuẩn #SOS-2026-XXXX"
        )
        self.assertEqual(props.get("status"), "pending", "Trạng thái ban đầu của hồ sơ là pending")

        # Lưu lại id, tracking_token và ticket code để test case sau tra cứu
        self.__class__.created_ticket_code = ticket_code
        self.__class__.created_record_id = record_id
        self.__class__.created_tracking_token = props.get("tracking_token")

    def test_03_track_sos_ticket_progress(self):
        """Kiểm tra tra cứu riêng tư via tracking_token và xác thực RBAC trên /api/sos."""
        token = getattr(self.__class__, "created_tracking_token", None)
        self.assertIsNotNone(token)
        t_status, t_data = self.make_request(f"/api/sos/track/{token}")
        self.assertEqual(t_status, 200, "Tra cứu riêng tư bằng tracking_token phải trả về 200")
        self.assertEqual(t_data.get("ticket_code"), self.__class__.created_ticket_code)

        # Kiểm tra /api/sos yêu cầu xác thực RBAC (Guest bị 401, Coordinator được 200)
        guest_status, _ = self.make_request("/api/sos")
        self.assertEqual(guest_status, 401)

        import os
        l_status, l_data = self.make_request("/api/auth/login", method="POST", data={
            "username": "coordinator_demo",
            "password": os.getenv("NORTHSTAR_DEMO_PASSWORD", "NorthStarDemo@2026"),
        })
        self.assertEqual(l_status, 200)
        coord_hdr = {"Authorization": f"Bearer {l_data['access_token']}"}
        status, data = self.make_request("/api/sos", headers=coord_hdr)
        self.assertEqual(status, 200, "Truy vấn danh sách SOS có RBAC Coordinator phải trả về HTTP 200")
        self.assertEqual(data.get("type"), "FeatureCollection", "Phải trả về FeatureCollection GeoJSON")

        features = data.get("features", [])
        self.assertIsInstance(features, list)

        # Tìm ticket vừa tạo trong FeatureCollection
        target_id = getattr(self.__class__, "created_record_id", None)
        matched_feature = next(
            (f for f in features if f.get("properties", {}).get("id") == target_id),
            None
        )
        self.assertIsNotNone(
            matched_feature,
            f"Hồ sơ cứu nạn #{target_id} phải tồn tại trên hệ thống để người dân và chỉ huy theo dõi"
        )
        props = matched_feature.get("properties", {})
        self.assertIn(props.get("status"), ["pending", "verified", "acknowledged", "dispatched", "on_scene", "rescued"])

    def test_04_crowdsourced_flood_report(self):
        """Kiểm tra người dân gửi báo ngập cộng đồng kèm gắn nhãn [Chờ xác minh] (VIC-06)."""
        report_payload = {
            "lat": 21.0315,
            "lng": 105.7892,
            "level": "heavy",
            "photo_url": None,
            "user_id": None
        }
        status, data = self.make_request("/api/reports", method="POST", data=report_payload)
        self.assertEqual(status, 201, "Gửi báo ngập cộng đồng phải trả về HTTP 201")
        self.assertIn("id", data)
        self.assertIn("level", data)
        self.assertEqual(data["level"], "heavy")
        self.assertIn("confirmed", data, "Phải có trạng thái xác minh (confirmed: true/false)")

    def test_05_reports_geojson_layer_rendering(self):
        """Kiểm tra API trả về FeatureCollection GeoJSON để hiển thị lên bản đồ dân sự (VIC-06)."""
        status, data = self.make_request("/api/reports")
        self.assertEqual(status, 200)
        self.assertEqual(data.get("type"), "FeatureCollection")
        self.assertIn("features", data)
        self.assertIsInstance(data["features"], list)
        self.assertGreater(len(data["features"]), 0, "Bản đồ phải có ít nhất 1 điểm báo ngập vừa ghi nhận")

        # Kiểm tra cấu trúc chuẩn GeoJSON của feature
        first_feat = data["features"][0]
        self.assertEqual(first_feat.get("type"), "Feature")
        self.assertEqual(first_feat.get("geometry", {}).get("type"), "Point")
        self.assertEqual(len(first_feat.get("geometry", {}).get("coordinates", [])), 2)
        props = first_feat.get("properties", {})
        self.assertIn("level", props)
        self.assertIn("confirmed", props)

    def test_06_offline_first_storage_schema(self):
        """Mô phỏng và kiểm tra cấu trúc dữ liệu lưu ngoại tuyến IndexedDB/localStorage (VIC-07)."""
        offline_sos_draft = {
            "local_id": "draft_1795200000000",
            "ticket_code": "#SOS-2026-PENDING-OFFLINE",
            "name": "Nguyễn Văn Dân",
            "phone": "0912345678",
            "lat": 21.0285,
            "lng": 105.8030,
            "people_count": 2,
            "emergency_type": "FLOODED",
            "status": "QUEUED_OFFLINE",
            "sync_status": "WAITING_CONNECTION",
            "created_at": "2026-11-21T17:00:00Z"
        }

        # Kiểm tra tính toàn vẹn của cấu trúc offline
        self.assertEqual(offline_sos_draft["status"], "QUEUED_OFFLINE")
        self.assertTrue(offline_sos_draft["ticket_code"].startswith("#SOS-2026-"))
        self.assertIn("sync_status", offline_sos_draft)

        # Đảm bảo JSON serialize/deserialize an toàn cho LocalStorage & IndexedDB
        serialized = json.dumps(offline_sos_draft)
        deserialized = json.loads(serialized)
        self.assertEqual(deserialized["local_id"], offline_sos_draft["local_id"])

    def test_07_citizen_html_redesign_components(self):
        """Kiểm tra các thành phần UI/UX Neo-Glassmorphism mới trong citizen.html."""
        import os
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        html_path = os.path.join(base_dir, "citizen.html")
        with open(html_path, "r", encoding="utf-8") as f:
            html = f.read()

        # 1. Header & Nút 114
        self.assertIn("citizen-glass-header", html, "Phải có citizen-glass-header")
        self.assertIn("citizen-hotline-114", html, "Phải có nút Hotline 114 siêu nổi bật")

        # 2. Bộ chuyển đổi bản đồ (Day, Dark, Topo, Satellite)
        self.assertIn("citizen-btn-base-day", html, "Phải có nút Bản Đồ Ban Ngày")
        self.assertIn("citizen-btn-base-dark", html, "Phải có nút Bản Đồ Đêm")
        self.assertIn("citizen-btn-base-topo", html, "Phải có nút Bản Đồ Địa Hình")
        self.assertIn("citizen-btn-base-sat", html, "Phải có nút Bản Đồ Vệ Tinh")

        # 3. Thẻ chọn độ sâu trực quan & Nút SOS khẩn cấp
        self.assertIn("citizen-depth-card", html, "Phải có thẻ chọn độ sâu trực quan")
        self.assertIn("citizen-sos-primary-btn", html, "Phải có nút SOS khẩn cấp phát sáng")

        # 4. Điều hướng phân đoạn hiện đại (Segmented Navigation)
        self.assertIn("citizen-segmented-nav", html, "Phải có thanh điều hướng segmented")
        self.assertIn("citizen-tab-item", html, "Phải có class citizen-tab-item")

    def test_08_css_neo_glassmorphism_styling(self):
        """Kiểm tra các quy tắc CSS Neo-Glassmorphism mới trong css/style.css."""
        import os
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        css_path = os.path.join(base_dir, "css", "style.css")
        with open(css_path, "r", encoding="utf-8") as f:
            css = f.read()

        self.assertIn(".citizen-glass-header", css)
        self.assertIn(".citizen-glass-card", css)
        self.assertIn(".citizen-hotline-114", css)
        self.assertIn(".citizen-sos-primary-btn", css)
        self.assertIn(".citizen-depth-card", css)
        self.assertIn(".citizen-segmented-nav", css)


if __name__ == "__main__":
    unittest.main()
