import frappe


def execute():
    fields = [
        {
            "fieldname": "email_communication_consent",
            "fieldtype": "Check",
            "label": "Email Communication Consent",
            "default": "0",
            "insert_after": "raised_by",
            "read_only": 1,
        },
        {
            "fieldname": "email_communication_consent_at",
            "fieldtype": "Datetime",
            "label": "Email Consent Captured At",
            "insert_after": "email_communication_consent",
            "read_only": 1,
        },
    ]

    for field in fields:
        if frappe.db.exists(
            "Custom Field",
            {"dt": "HD Ticket", "fieldname": field["fieldname"]},
        ):
            continue

        frappe.get_doc(
            {
                "doctype": "Custom Field",
                "dt": "HD Ticket",
                "module": "TikSupport",
                **field,
            }
        ).insert(ignore_permissions=True)
