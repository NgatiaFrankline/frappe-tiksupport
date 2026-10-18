import frappe
from frappe import _
from frappe.core.doctype.navbar_settings.navbar_settings import get_app_logo


def set_ticket_context(context):
    context.csrf_token = frappe.sessions.get_csrf_token()
    context.site_logo = get_app_logo()
    after_ticket_settings = frappe.get_single("TikSupport Settings")
    contact_settings = frappe.get_single("TikSupport Contact Settings")
    footer_settings = frappe.get_single("TikSupport Footer Settings")
    navbar_settings = frappe.get_single("TikSupport Navbar Settings")
    recaptcha_settings = frappe.get_single("TikSupport reCAPTCHA Settings")
    context.recaptcha_enabled = bool(recaptcha_settings.enabled)
    context.recaptcha_site_key = recaptcha_settings.site_key or ""
    context.after_ticket_steps = after_ticket_settings.get("after_ticket_steps") or [
        {"step": _("We only respond to the email address you entered in the form.")},
        {"step": _("Check your email regularly for updates on your request.")},
        {
            "step": _(
                "Check your ticket status using your email address and ticket number on the"
            ),
            "link_label": _("Check ticket status"),
            "url": "/view-ticket-status",
            "link_suffix": _("page."),
        },
    ]
    context.support_contacts = contact_settings.get("support_contacts") or []
    context.help_links = footer_settings.get("help_links") or [
        {"label": _("Create a ticket"), "url": "/create-ticket", "icon": "plus"},
        {
            "label": _("Check ticket status"),
            "url": "/view-ticket-status",
            "icon": "search",
        },
        {"label": _("Home"), "url": "/", "icon": "home"},
    ]
    context.navbar_links = navbar_settings.get("navbar_links") or [
        {"label": _("Create ticket"), "url": "/create-ticket"},
        {"label": _("Check ticket status"), "url": "/view-ticket-status"},
        {"label": _("Go to eLearning"), "url": "/"},
    ]
    return context
