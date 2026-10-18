from urllib.parse import urlsplit

import frappe
from frappe import _


def validate_settings_url(url):
    url = (url or "").strip()
    try:
        parsed = urlsplit(url)
    except ValueError:
        parsed = None

    is_relative = url.startswith("/") and not url.startswith("//")
    is_web_url = parsed and parsed.scheme in ("http", "https") and bool(parsed.netloc)

    if not (is_relative or is_web_url):
        frappe.throw(
            _("URLs must be relative paths or start with http:// or https://.")
        )


def validate_after_ticket_steps(steps):
    for step in steps:
        if bool(step.link_label) != bool(step.url):
            frappe.throw(_("Provide both a link label and URL for an instruction link."))
        if step.url:
            validate_settings_url(step.url)
