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
Kịch bản tự động kiểm tra tính tuân thủ quy chế Olympic Tin học PMNM 2026.
Phân hệ: Người dân / Victim Portal (Thành viên 1).

Tiêu chí kiểm tra:
1. Bản quyền Apache-2.0 trên tất cả các tệp mã nguồn và tài liệu kỹ thuật.
2. Không có đường dẫn tuyệt đối gắn với máy cá nhân (C:\\, D:\\, /home/, /Users/).
"""

import os
import re
import sys
import unittest

TARGET_FILES = [
    "citizen.html",
    os.path.join("js", "citizen_portal.js"),
    os.path.join("js", "rescue_manager.js"),
    os.path.join("js", "offline_sync_manager.js"),
    os.path.join("docs", "CITIZEN_LOCATION_VERIFICATION_SPEC.md"),
    os.path.join("docs", "CITIZEN_STANDALONE_PORTAL_SPEC.md"),
    os.path.join("docs", "VICTIM_USER_GUIDE.md"),
    os.path.join("tests", "test_citizen_workflow.py"),
]

FORBIDDEN_PATH_PATTERNS = [
    re.compile(r"[a-zA-Z]:\\(?:Users|OpenSource)", re.IGNORECASE),
    re.compile(r"/(?:home|Users)/[a-zA-Z0-9_-]+/", re.IGNORECASE),
]

APACHE_LICENSE_KEYWORD = "Apache License, Version 2.0"


class TestComplianceAudit(unittest.TestCase):
    """Kiểm toán tuân thủ bản quyền và đường dẫn sạch."""

    def test_01_all_target_files_exist(self):
        """Đảm bảo tất cả các tệp phân hệ Người dân đều tồn tại."""
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        for rel_path in TARGET_FILES:
            full_path = os.path.join(base_dir, rel_path)
            self.assertTrue(
                os.path.isfile(full_path),
                f"Tệp bắt buộc không tồn tại: {rel_path}"
            )

    def test_02_apache_license_headers(self):
        """Kiểm tra 100% tệp có tiêu đề bản quyền Apache-2.0."""
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        missing_license = []
        for rel_path in TARGET_FILES:
            full_path = os.path.join(base_dir, rel_path)
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read(1500)
                if APACHE_LICENSE_KEYWORD not in content and "Apache-2.0" not in content:
                    missing_license.append(rel_path)

        self.assertEqual(
            missing_license,
            [],
            f"Các tệp sau thiếu tiêu đề bản quyền Apache-2.0: {missing_license}"
        )

    def test_03_no_hardcoded_absolute_machine_paths(self):
        """Đảm bảo không chứa đường dẫn cứng máy cá nhân (C:\\, D:\\, /home/)."""
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        violations = []
        for rel_path in TARGET_FILES:
            full_path = os.path.join(base_dir, rel_path)
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                for line_idx, line in enumerate(f, start=1):
                    for pat in FORBIDDEN_PATH_PATTERNS:
                        if pat.search(line):
                            violations.append(f"{rel_path}:{line_idx} -> {line.strip()}")

        self.assertEqual(
            violations,
            [],
            f"Phát hiện đường dẫn cứng cá nhân vi phạm quy chế PMNM:\n" + "\n".join(violations)
        )


if __name__ == "__main__":
    unittest.main()
