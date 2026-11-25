"""
Phase 9 (CIT-10) Citizen SOS Tracking & Privacy Frontend Tests (TRACK-11..14).
"""
import os
import unittest

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


class TestPhase9CitizenTrackingFrontend(unittest.TestCase):
    def test_track_11_to_14_no_fake_ticket_or_public_sos_list(self):
        with open(os.path.join(FRONTEND_DIR, 'citizen.html'), 'r', encoding='utf-8') as f:
            html = f.read()
        with open(os.path.join(FRONTEND_DIR, 'js', 'rescue_manager.js'), 'r', encoding='utf-8') as f:
            rescue_js = f.read()

        # TRACK-14: No hardcoded fake #SOS-2026-0001 or fake DISPATCHED status in citizen.html
        self.assertNotIn("code = '#SOS-2026-0001'", html)
        self.assertNotIn("displayStatus.textContent = 'ĐANG ĐIỀU PHỐI ĐỘI CỨU HỘ'", html)
        self.assertIn('/api/sos/track/', html)
        self.assertIn("'X-NorthStar-Client': 'citizen'", html)

        # TRACK-12 & TRACK-13: Offline cached track fallback explicitly labeled
        self.assertIn('CACHE NGOẠI TUYẾN', html)
        self.assertIn('last_sos_track_status', html)
        self.assertIn('revokeCurrentTrackingToken', html)

        # Tracking token stored in IndexedDB, not localStorage
        self.assertNotIn("localStorage.setItem('northstar_tracking_token'", rescue_js)
        self.assertIn('tracking_token', rescue_js)


if __name__ == '__main__':
    unittest.main(verbosity=2)
