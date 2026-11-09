from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase
from werkzeug.wrappers import Response

from helpdesk.helpdesk.doctype.hd_ticket.hd_ticket import has_permission
from helpdesk.test_utils import make_ticket
from tiksupport.settings_validation import validate_settings_url
from tiksupport.api import (
    check_ticket_status,
    create_ticket,
    inject_helpdesk_sidebar_assets,
    reply_to_ticket,
    verify_recaptcha,
)


class TestTikSupportAPI(FrappeTestCase):
    def setUp(self):
        frappe.set_user("Administrator")
        frappe.db.set_single_value("TikSupport reCAPTCHA Settings", "enabled", 0)
        if not frappe.db.exists("HD Ticket Type", "Cannot sign in"):
            frappe.get_doc(
                {"doctype": "HD Ticket Type", "name": "Cannot sign in"}
            ).insert(ignore_permissions=True)
        frappe.set_user("Guest")

    def tearDown(self):
        frappe.set_user("Administrator")

    def test_guest_can_create_ticket_without_ticket_record_access(self):
        result = create_ticket(
            "student@example.com",
            "Cannot sign in",
            "<script>alert('x')</script>\nPlease help.",
            email_communication_consent=True,
        )
        ticket = frappe.get_doc("HD Ticket", result["name"])

        self.assertEqual(ticket.raised_by, "student@example.com")
        self.assertEqual(ticket.ticket_type, "Cannot sign in")
        self.assertEqual(ticket.subject, "Cannot sign in")
        self.assertEqual(ticket.owner, "Administrator")
        self.assertEqual(ticket.via_customer_portal, 0)
        self.assertEqual(ticket.email_communication_consent, 1)
        self.assertTrue(ticket.email_communication_consent_at)
        self.assertNotIn("<script>", ticket.description)
        self.assertFalse(has_permission(ticket, user="Guest"))

    def test_status_lookup_requires_matching_email_and_limits_data(self):
        ticket = make_ticket(raised_by="student@example.com")

        result = check_ticket_status(ticket.name, "STUDENT@example.com")

        self.assertEqual(result["name"], ticket.name)
        self.assertEqual(result["subject"], ticket.subject)
        self.assertIn("status", result)
        self.assertNotIn("description", result)
        with self.assertRaises(frappe.DoesNotExistError):
            check_ticket_status(ticket.name, "someone-else@example.com")

    def test_guest_can_read_and_reply_to_ticket_conversation(self):
        created = create_ticket(
            "student@example.com",
            "Cannot sign in",
            "Please help.",
            email_communication_consent=True,
        )

        result = check_ticket_status(created["name"], "student@example.com")
        self.assertIn("conversation", result)

        reply = reply_to_ticket(
            created["name"],
            "STUDENT@example.com",
            "I have attached more details.",
        )
        self.assertTrue(
            any(
                "I have attached more details." in communication["content"]
                for communication in reply["conversation"]
            )
        )

    def test_ticket_submission_rejects_invalid_email(self):
        with self.assertRaises(frappe.InvalidEmailAddressError):
            create_ticket(
                "not-an-email",
                "Cannot sign in",
                "Please help.",
                email_communication_consent=True,
            )

    def test_ticket_submission_rejects_unknown_ticket_type(self):
        with self.assertRaises(frappe.ValidationError):
            create_ticket(
                "student@example.com",
                "No such type",
                "Please help.",
                email_communication_consent=True,
            )

    def test_ticket_submission_requires_email_communication_consent(self):
        with self.assertRaises(frappe.ValidationError):
            create_ticket("student@example.com", "Cannot sign in", "Please help.")

    def test_quick_link_urls_reject_unsafe_schemes(self):
        validate_settings_url("/view-ticket-status")
        validate_settings_url("https://example.com/help")
        with self.assertRaises(frappe.ValidationError):
            validate_settings_url("javascript:alert(1)")

    @patch("tiksupport.api.requests.post")
    @patch("tiksupport.api.frappe.get_single")
    def test_recaptcha_verification_checks_google_response(self, get_single, post):
        get_single.return_value = frappe._dict(
            enabled=1,
            site_key="public-site-key",
            get_password=lambda fieldname, raise_exception=False: "private-secret",
        )
        post.return_value.json.return_value = {"success": True}

        verify_recaptcha("captcha-response")

        post.assert_called_once_with(
            "https://www.google.com/recaptcha/api/siteverify",
            data={"secret": "private-secret", "response": "captcha-response"},
            timeout=5,
        )

        post.return_value.json.return_value = {"success": False}
        with self.assertRaises(frappe.ValidationError):
            verify_recaptcha("invalid-response")

    def test_helpdesk_spa_loads_tiksupport_sidebar_assets_once(self):
        response = Response(
            "<html><head></head><body>"
            '<div id="app"></div>'
            "<script src='/assets/helpdesk/desk/assets/index.js'></script>"
            "</body></html>",
            mimetype="text/html",
        )
        request = frappe._dict(path="/helpdesk")
        global_stylesheet = "/assets/tiksupport/dist/css/tiksupport_global.bundle.TEST.css"
        stylesheet = "/assets/tiksupport/dist/css/helpdesk_sidebar.bundle.TEST.css"
        script = "/assets/tiksupport/dist/js/helpdesk_sidebar.bundle.TEST.js"
        with patch(
            "tiksupport.api.get_assets_json",
            return_value={
                "tiksupport_global.bundle.css": global_stylesheet,
                "helpdesk_sidebar.bundle.css": stylesheet,
                "helpdesk_sidebar.bundle.ts": script,
            },
        ), patch("tiksupport.api.frappe.db.exists", return_value=True):
            inject_helpdesk_sidebar_assets(response, request)
            inject_helpdesk_sidebar_assets(response, request)

        self.assertEqual(
            response.get_data(as_text=True).count(
                f'<link rel="stylesheet" href="{global_stylesheet}">'
            ),
            1,
        )
        self.assertEqual(
            response.get_data(as_text=True).count(
                f'<link rel="stylesheet" href="{stylesheet}">'
            ),
            1,
        )
        self.assertEqual(
            response.get_data(as_text=True).count(f'<script src="{script}"></script>'),
            1,
        )
        self.assertEqual(
            response.get_data(as_text=True).count(
                'class="tiksupport-helpdesk-loader"'
            ),
            1,
        )
        self.assertIn(
            '<div id="app"><div class="tiksupport-helpdesk-loader"',
            response.get_data(as_text=True),
        )
        self.assertIn(
            '<span class="tiksupport-helpdesk-loader__message">Loading Helpdesk...</span>',
            response.get_data(as_text=True),
        )
